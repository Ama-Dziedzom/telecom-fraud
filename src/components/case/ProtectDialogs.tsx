"use client";

import { RequestError } from "@/components/auth/RequestError";
import { useStepUp } from "@/components/app/StepUp";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CheckCard, OptionCard } from "@/components/ui/Choice";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isProblem } from "@/lib/api/client";
import { useCaseTransactions, type CaseDetail } from "@/lib/api/cases";
import { useApi, type ActionPart, type PersonRef, type ProtectiveAction } from "@/lib/api/fd";
import { formatMoney } from "@/lib/time";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { StepList, firstName, localMsisdn, type StepState } from "./parts";

export type ProtectKind = "freeze_wallet" | "suspend_sim" | "block_recipients" | "send_safety_sms";

const REASONS = [
  ["suspected_sim_swap", "Suspected SIM-swap fraud"],
  ["suspected_account_takeover", "Suspected account takeover"],
  ["mule_activity", "Money moving to mule wallets"],
  ["subscriber_request", "Subscriber asked us to block"],
] as const;

const PART_LABEL: Record<string, { doing: string; done: string; waiting: string; failed: string }> = {
  freeze_wallet: { doing: "Freezing wallet", done: "Wallet frozen", waiting: "Freeze wallet", failed: "Wallet freeze" },
  suspend_sim: { doing: "Suspending SIM", done: "SIM suspended", waiting: "Suspend the SIM", failed: "SIM suspension" },
  block_wallets: { doing: "Blocking {n}recipient wallets", done: "{n}recipient wallets blocked", waiting: "Block {n}recipient wallets", failed: "Wallet block" },
  block_recipients: { doing: "Blocking {n}recipient wallets", done: "{n}recipient wallets blocked", waiting: "Block {n}recipient wallets", failed: "Wallet block" },
  send_safety_sms: { doing: "Sending safety SMS", done: "Safety SMS sent", waiting: "Send safety SMS", failed: "Safety SMS" },
  bar_sims_on_id: { doing: "Barring SIMs", done: "SIMs barred", waiting: "Bar SIMs", failed: "SIM barring" },
};

/** “4 recipient wallets blocked” — the count only where there are targets; sentence case at the start. */
export const partLabel = (p: ActionPart, state: "doing" | "done" | "waiting" | "failed") => {
  const label = (PART_LABEL[p.kind]?.[state] ?? p.kind.replace(/_/g, " ")).replace("{n}", p.targets?.length ? `${p.targets.length} ` : "");
  return label[0].toUpperCase() + label.slice(1);
};

const PART_ERROR: Record<string, string> = {
  feed_unavailable: "The network (HLR) didn’t respond in 30 s",
  upstream_timeout: "The operator’s system timed out",
};
/** Why a part failed, from its code. */
export const partError = (code?: string | null) => (code && PART_ERROR[code]) || "It didn’t go through";

/** The three protective actions the menu’s first item opens with (D1 → D2). */
const ALL: ProtectKind[] = ["freeze_wallet", "suspend_sim", "block_recipients"];
const VERB: Record<ProtectKind, string> = { freeze_wallet: "freeze", suspend_sim: "suspend", block_recipients: "block", send_safety_sms: "send safety SMS" };

/** D2 · Protect · confirm — what happens, why, and what the subscriber loses. */
export function ProtectCaseModal({
  detail,
  initial,
  targets,
  onClose,
  onApplying,
}: {
  detail: CaseDetail;
  initial: ProtectKind[];
  /** Wallets to block when coming from the network panel. */
  targets?: string[];
  onClose: () => void;
  onApplying: (action: ProtectiveAction) => void;
}) {
  const { data: txs } = useCaseTransactions(detail.id);
  const stepUp = useStepUp();
  const done = new Set<string>(detail.next_steps.done);
  const [picked, setPicked] = useState<Set<ProtectKind>>(() => new Set(initial.length === 1 && initial[0] === "freeze_wallet" ? ALL : initial));
  const [reason, setReason] = useState<string>(REASONS[0][0]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const recipients =
    // TODO(api): transactions name the counterparty but not its entity ID (wal_8812), so the masked number is sent.
    targets ?? Array.from(new Set(txs?.data.filter((t) => t.flagged && t.counterparty_new && t.where_now !== "agent_holds").map((t) => t.counterparty)));
  const balance = txs ? formatMoney(txs.totals.balance.amount_minor, txs.totals.balance.currency, { decimals: true }) : null;
  const number = localMsisdn(detail.subject.msisdn);
  const shown: ProtectKind[] = initial.includes("send_safety_sms") ? [...ALL, "send_safety_sms"] : ALL;

  const toggle = (k: ProtectKind, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const actions = shown.filter((k) => picked.has(k) && !done.has(k));
  const words = actions.map((k) => VERB[k]);
  const sentence = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : (words[0] ?? "");
  const label = actions.length ? `${sentence[0].toUpperCase()}${sentence.slice(1)} (${actions.length})` : "Choose an action";
  const wallet = picked.has("freeze_wallet") && !done.has("freeze_wallet");
  const sim = picked.has("suspend_sim") && !done.has("suspend_sim");

  const card: Record<ProtectKind, { title: string; description: string }> = {
    freeze_wallet: { title: "Freeze MoMo wallet", description: `${balance ? `${balance} held · ` : ""}no transfers or cash-outs` },
    suspend_sim: { title: "Suspend SIM", description: `Calls, SMS and USSD blocked on ${number}` },
    block_recipients: { title: `Block ${recipients.length ? `${recipients.length} ` : ""}recipient wallets`, description: "Watchlist for 30 days" },
    send_safety_sms: { title: "Send a safety SMS", description: `To ${detail.contact?.alt_msisdn ?? number}: “Did you make these payments? Call 100.”` },
  };

  const submit = async () => {
    if (!actions.length) return;
    setBusy(true);
    setFailure(null);
    try {
      const action = await stepUp(() =>
        apiFetch<ProtectiveAction>("POST", `/cases/${detail.id}/actions`, {
          parts: actions.map((kind) =>
            kind === "block_recipients" ? { kind: "block_wallets", targets: recipients, days: 30 } : { kind, target: detail.subject.subscriber_id },
          ),
          reason,
          note: REASONS.find(([id]) => id === reason)?.[1] ?? reason,
        }),
      );
      onApplying(action);
    } catch (err) {
      if (!(err instanceof Error && err.message === "step_up_cancelled")) setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={`Protect ${number}`}
      description={`${detail.id} · ${detail.title}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={submit} loading={busy} disabled={!actions.length}>
            {label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {shown.map((k) => (
          <CheckCard
            key={k}
            checked={picked.has(k) || done.has(k)}
            disabled={done.has(k)}
            onChange={(e) => toggle(k, e.target.checked)}
            title={done.has(k) ? `${card[k].title} · done` : card[k].title}
            description={card[k].description}
          />
        ))}
      </div>
      <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </Select>
      {(wallet || sim) && (
        <Banner tone="warning" title={`${firstName(detail.subject.name)} will lose ${wallet && sim ? "MoMo and SIM" : wallet ? "MoMo" : "SIM"} access`}>
          They’ll need to visit a branch with their Ghana Card to restore {wallet && sim ? "them" : "it"}. A supervisor can undo this.
        </Banner>
      )}
      <RequestError error={failure} />
    </Modal>
  );
}

/** D3 · Applying N actions — each part ticks as the operator’s systems confirm it. */
export function ApplyingModal({ action: initial, caseId, onClose }: { action: ProtectiveAction; caseId: string; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [background, setBackground] = useState(false);
  const { data } = useApi<ProtectiveAction>(`/actions/${initial.id}`, { refreshInterval: (a) => (a && a.status !== "applying" ? 0 : 900) });
  const action = data ?? initial;
  const finished = action.status !== "applying";

  // When it settles: refresh the case and say how it went (D4/D5).
  useEffect(() => {
    if (!finished) return;
    void mutate(`/cases/${caseId}`);
    void mutate(`/cases/${caseId}/timeline`);
    const failed = action.parts.filter((p) => p.status === "failed");
    const applied = action.parts.filter((p) => p.status === "applied");
    if (failed.length) {
      toast({
        tone: "error",
        title: `${partLabel(failed[0], "failed")} failed`,
        body: `${applied.length ? `${applied.map((p) => partLabel(p, "done")).join(", ")}, but ` : ""}${failed[0].kind === "suspend_sim" ? "the SIM is still active" : `${failed.length === 1 ? "one action" : "some actions"} didn’t go through`}.`,
      });
    } else {
      toast({
        tone: "success",
        title: `${action.parts.length} ${action.parts.length === 1 ? "action" : "actions"} applied`,
        body: `${action.parts.map((p) => partLabel(p, "done")).join(", ")}.`,
      });
    }
    onClose();
    // Only when it finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (background) return null;
  const current = action.parts.findIndex((x) => x.status === "pending");
  return (
    <Modal
      open
      onClose={() => setBackground(true)}
      title={`Applying ${action.parts.length} ${action.parts.length === 1 ? "action" : "actions"}`}
      description="Keep this open or carry on. We’ll tell you when it’s done."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={() => setBackground(true)}>
            Run in background
          </Button>
          <Button size="md" loading={!finished} loadingLabel="Applying" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <StepList
        steps={action.parts.map((p, i) => {
          const state: StepState = p.status === "applied" ? "done" : p.status === "failed" ? "failed" : i === current ? "current" : "todo";
          const label =
            state === "done"
              ? `${partLabel(p, "done")}${p.reference ? ` · ${p.reference}` : ""}`
              : state === "failed"
                ? `${partLabel(p, "failed")} failed · ${partError(p.code).replace(/^./, (c) => c.toLowerCase())}`
                : state === "current"
                  ? `${partLabel(p, "doing")} · ${p.kind === "suspend_sim" ? "waiting for the network (HLR)" : "waiting for the operator’s systems"}`
                  : partLabel(p, "waiting");
          return { state, label };
        })}
      />
    </Modal>
  );
}

/** D6 · Over your limit — escalate for all, or bar what you’re allowed and escalate the rest. */
export function BarSimsModal({
  detail,
  onClose,
  onEscalate,
  onApplying,
}: {
  detail: CaseDetail;
  onClose: () => void;
  onEscalate: (question: string) => void;
  onApplying: (action: ProtectiveAction) => void;
}) {
  const stepUp = useStepUp();
  const [limit, setLimit] = useState<{ limit: number; requested: number; approver: PersonRef } | null>(null);
  const [choice, setChoice] = useState<"escalate" | "partial">("escalate");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  // Ask for all of them first; the API says how many this role may bar.
  useEffect(() => {
    apiFetch("POST", `/cases/${detail.id}/actions`, { parts: [{ kind: "bar_sims_on_id", target: detail.subject.subscriber_id, count: 14 }], reason: "mule_activity", note: "Bar all SIMs on this Ghana Card" })
      .then((a) => onApplying(a as ProtectiveAction))
      .catch((err) => {
        if (isProblem(err, "limit_exceeded")) {
          const p = err.problem as unknown as { limit: number; requested: number; approver: PersonRef };
          setLimit({ limit: p.limit, requested: p.requested, approver: p.approver });
        } else setFailure(err);
      });
    // Once, when opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approver = firstName(limit?.approver.name) || "your supervisor";
  const go = async () => {
    if (!limit) return;
    if (choice === "escalate") {
      onEscalate(`Please bar all ${limit.requested} SIMs on this Ghana Card: ${limit.requested - 2} activated this month. Over my limit of ${limit.limit}.`);
      return;
    }
    setBusy(true);
    try {
      const action = await stepUp(() =>
        apiFetch<ProtectiveAction>("POST", `/cases/${detail.id}/actions`, {
          parts: [{ kind: "bar_sims_on_id", target: detail.subject.subscriber_id, count: limit.limit }],
          reason: "mule_activity",
          note: `Barred the ${limit.limit} most active; escalating the remaining ${limit.requested - limit.limit}.`,
        }),
      );
      onApplying(action);
      onEscalate(`I barred the ${limit.limit} most active SIMs on this Ghana Card. Please approve barring the remaining ${limit.requested - limit.limit}.`);
    } catch (err) {
      if (!(err instanceof Error && err.message === "step_up_cancelled")) setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={limit ? `Bar ${limit.requested} SIMs on this Ghana Card?` : "Checking SIMs on this Ghana Card…"}
      description={limit ? `${limit.requested - 2} activated this month. You can bar up to ${limit.limit} per case.` : undefined}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" disabled={!limit} loading={busy} onClick={go}>
            {choice === "escalate" ? `Escalate to ${approver}` : `Bar ${limit?.limit ?? 10} and escalate`}
          </Button>
        </>
      }
    >
      {limit && (
        <>
          <Banner tone="warning" title={`${limit.requested} is over your limit of ${limit.limit}`}>
            Ask {approver} to lift it, or bar the {limit.limit} most active now.
          </Banner>
          <div className="flex flex-col gap-2">
            <OptionCard name="bar" checked={choice === "escalate"} onChange={() => setChoice("escalate")} title={`Escalate to ${approver} for all ${limit.requested}`} description="The request is pre-filled with the SIM list" indent />
            <OptionCard name="bar" checked={choice === "partial"} onChange={() => setChoice("partial")} title={`Bar the ${limit.limit} most active now`} description={`Then escalate the other ${limit.requested - limit.limit}`} indent />
          </div>
        </>
      )}
      <RequestError error={failure} />
    </Modal>
  );
}
