"use client";

import { RequestError } from "@/components/auth/RequestError";
import { useStepUp } from "@/components/app/StepUp";
import { Banner } from "@/components/ui/Banner";
import { Button, Spinner } from "@/components/ui/Button";
import { CheckCard, OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Select, TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isProblem } from "@/lib/api/client";
import { useCaseTransactions, type CaseDetail } from "@/lib/api/cases";
import { useApi, type ActionPart, type PersonRef, type ProtectiveAction } from "@/lib/api/fd";
import { formatMoney } from "@/lib/time";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";

export type ProtectKind = "freeze_wallet" | "suspend_sim" | "block_recipients" | "reversal";

const REASONS = [
  ["suspected_sim_swap", "Suspected SIM-swap fraud"],
  ["suspected_account_takeover", "Suspected account takeover"],
  ["mule_activity", "Money moving to mule wallets"],
  ["subscriber_request", "Subscriber asked us to block"],
] as const;

const PART_LABEL: Record<string, { doing: string; done: string; waiting: string; failed: string }> = {
  freeze_wallet: { doing: "Freezing wallet…", done: "Wallet frozen", waiting: "Freeze wallet", failed: "Wallet freeze" },
  suspend_sim: { doing: "Suspending SIM…", done: "SIM suspended", waiting: "Suspend SIM", failed: "SIM suspension" },
  block_wallets: { doing: "Blocking {n}recipient wallets…", done: "{n}recipient wallets blocked", waiting: "Block {n}recipient wallets", failed: "Wallet block" },
  block_recipients: { doing: "Blocking {n}recipient wallets…", done: "{n}recipient wallets blocked", waiting: "Block {n}recipient wallets", failed: "Wallet block" },
  send_safety_sms: { doing: "Sending safety SMS…", done: "Safety SMS sent", waiting: "Send safety SMS", failed: "Safety SMS" },
  bar_sims_on_id: { doing: "Barring SIMs…", done: "SIMs barred", waiting: "Bar SIMs", failed: "SIM barring" },
};

/** “4 recipient wallets blocked” — the count only where there are targets; sentence case at the start. */
export const partLabel = (p: ActionPart, state: "doing" | "done" | "waiting" | "failed") => {
  const label = (PART_LABEL[p.kind]?.[state] ?? p.kind.replace(/_/g, " ")).replace("{n}", p.targets?.length ? `${p.targets.length} ` : "");
  return label[0].toUpperCase() + label.slice(1);
};

const PART_ERROR: Record<string, string> = {
  feed_unavailable: "Network provisioning (HLR) didn’t respond",
  upstream_timeout: "The operator’s system timed out",
};
/** Why a part failed, from its code. */
export const partError = (code?: string | null) => (code && PART_ERROR[code]) || "It didn’t go through";

/** D2 · Protect · confirm — what happens, why, and what the subscriber loses. */
export function ProtectCaseModal({
  detail,
  initial,
  targets,
  onClose,
  onApplying,
  onReversal,
}: {
  detail: CaseDetail;
  initial: ProtectKind[];
  /** Wallets to block when coming from the network panel. */
  targets?: string[];
  onClose: () => void;
  onApplying: (action: ProtectiveAction) => void;
  onReversal: () => void;
}) {
  const { data: txs } = useCaseTransactions(detail.id);
  const stepUp = useStepUp();
  const done = new Set(detail.next_steps.done);
  const [picked, setPicked] = useState<Set<ProtectKind>>(
    () => new Set(initial.length === 1 && initial[0] === "freeze_wallet" ? (["freeze_wallet", "suspend_sim", "block_recipients"] as ProtectKind[]) : initial),
  );
  const [reason, setReason] = useState<string>(REASONS[0][0]);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const recipients =
    // TODO(api): transactions name the counterparty but not its entity ID (wal_8812), so the masked number is sent.
    targets ?? Array.from(new Set(txs?.data.filter((t) => t.flagged && t.counterparty_new && t.where_now !== "agent_holds").map((t) => t.counterparty)));
  const flaggedOut = txs?.data.filter((t) => t.flagged) ?? [];
  const reversible = flaggedOut.reduce((s, t) => s + t.amount.amount_minor, 0);
  const first = detail.subject.name.split(" ")[0];

  const toggle = (k: ProtectKind, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const actions = (["freeze_wallet", "suspend_sim", "block_recipients"] as const).filter((k) => picked.has(k) && !done.has(k));
  const verbs = { freeze_wallet: "Freeze", suspend_sim: "suspend", block_recipients: "block" };
  const label = actions.length ? `${actions.map((k, i) => (i === 0 ? verbs[k][0].toUpperCase() + verbs[k].slice(1) : verbs[k])).join(", ").replace(/, ([^,]*)$/, " & $1")} (${actions.length})` : "Choose an action";
  const losesAccess = picked.has("freeze_wallet") || picked.has("suspend_sim");

  const submit = async () => {
    setTried(true);
    if (!note.trim() || (!actions.length && !picked.has("reversal"))) return;
    if (!actions.length) {
      onReversal();
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const action = await stepUp(() =>
        apiFetch<ProtectiveAction>("POST", `/cases/${detail.id}/actions`, {
          parts: actions.map((kind) =>
            kind === "block_recipients"
              ? { kind: "block_wallets", targets: recipients, days: 30 }
              : { kind, target: detail.subject.subscriber_id },
          ),
          reason,
          note,
        }),
      );
      onApplying(action);
      if (picked.has("reversal")) onReversal();
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
      width={600}
      title={`Protect ${detail.subject.msisdn}`}
      description={`${detail.id} · ${detail.title}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={submit} loading={busy} iconLeft={<Icon name="app/icon-shield-white-18" size={18} />}>
            {actions.length ? label : picked.has("reversal") ? "Request reversal" : label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <CheckCard
          checked={picked.has("freeze_wallet") || done.has("freeze_wallet")}
          disabled={done.has("freeze_wallet")}
          onChange={(e) => toggle("freeze_wallet", e.target.checked)}
          title={done.has("freeze_wallet") ? "Freeze MoMo wallet · done" : "Freeze MoMo wallet"}
          description="GHS 312.40 held · no transfers or cash-outs"
        />
        <CheckCard
          checked={picked.has("suspend_sim")}
          onChange={(e) => toggle("suspend_sim", e.target.checked)}
          title="Suspend SIM"
          description={`Calls, SMS and USSD blocked on ${detail.subject.msisdn}`}
        />
        <CheckCard
          checked={picked.has("block_recipients")}
          onChange={(e) => toggle("block_recipients", e.target.checked)}
          title={`Block ${recipients.length || ""} recipient wallets`.replace("  ", " ")}
          description="Watchlist for 30 days"
        />
        <CheckCard
          checked={picked.has("reversal")}
          onChange={(e) => toggle("reversal", e.target.checked)}
          title={`Request reversal of ${flaggedOut.length} transfers`}
          description={`${formatMoney(reversible, "GHS")} · sent to MoMo ops for approval`}
        />
      </div>
      <Select label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </Select>
      <TextArea
        label="Note for the audit log"
        required
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What did you see that makes this necessary?"
        error={tried && !note.trim() ? "Add a note: it goes on the audit log with the action." : undefined}
      />
      {losesAccess && (
        <Banner tone="warning" title={`${first} will lose ${picked.has("freeze_wallet") && picked.has("suspend_sim") ? "MoMo and SIM" : picked.has("freeze_wallet") ? "MoMo" : "SIM"} access`}>
          They’ll need to visit a branch with their Ghana Card to restore it. A supervisor can undo this.
        </Banner>
      )}
      <RequestError error={failure} />
    </Modal>
  );
}

/** D3 · Applying N actions — each part ticks as the operator’s systems confirm it. */
export function ApplyingModal({
  action: initial,
  caseId,
  onClose,
}: {
  action: ProtectiveAction;
  caseId: string;
  onClose: () => void;
}) {
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
    if (failed.length) {
      toast({
        title: `${partLabel(failed[0], "failed")} failed`,
        body: `${action.parts.filter((p) => p.status === "applied").map((p) => partLabel(p, "done")).join(", ")}, but ${failed.length === 1 ? "one action" : "some actions"} didn’t go through.`,
        action: {
          label: "Retry",
          onClick: () => void apiFetch("POST", `/actions/${action.id}/retry`).then(() => mutate(`/cases/${caseId}`)),
        },
      });
    } else {
      toast({
        tone: "success",
        title: `${action.parts.length} ${action.parts.length === 1 ? "action" : "actions"} applied`,
        body: `${action.parts.map((p) => partLabel(p, "done")).join(", ")}.`,
        action: { label: "View", onClick: () => document.getElementById("case-banners")?.scrollIntoView({ behavior: "smooth" }) },
      });
    }
    onClose();
    // Only when it finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (background) return null;
  return (
    <Modal
      open
      onClose={() => setBackground(true)}
      width={520}
      icon="app/icon-shield-brand-22"
      tone="brand"
      title={`Applying ${action.parts.length} ${action.parts.length === 1 ? "action" : "actions"}`}
      description="Keep this open or carry on, you’ll be notified."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={() => setBackground(true)}>
            Run in background
          </Button>
          <Button size="md" loading={!finished} loadingLabel="Applying…" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-3">
        {action.parts.map((p, i) => {
          const current = p.status === "pending" && action.parts.findIndex((x) => x.status === "pending") === i;
          return (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center">
                {p.status === "applied" ? (
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-success-fg">
                    <Icon name="app/icon-check-white-10" size={10} />
                  </span>
                ) : p.status === "failed" ? (
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-critical-fg">
                    <Icon name="app/icon-x-white-18" size={10} />
                  </span>
                ) : current ? (
                  <Spinner tone="brand" />
                ) : (
                  <span className="size-[18px] rounded-full border-[1.5px] border-border-default" />
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={p.status === "pending" && !current ? "text-body-m text-text-tertiary" : "text-label-m text-text-primary"}>
                  {p.status === "applied" ? partLabel(p, "done") : p.status === "failed" ? `${partLabel(p, "failed")} failed` : current ? partLabel(p, "doing") : partLabel(p, "waiting")}
                </span>
                {(p.status !== "pending" || current) && (
                  <span className={p.status === "failed" ? "text-caption text-critical-fg" : "text-caption text-text-secondary"}>
                    {p.status === "failed"
                      ? partError(p.code)
                      : current
                        ? p.kind === "suspend_sim"
                          ? "Waiting for the network provisioning system (HLR)"
                          : "Waiting for the operator’s systems"
                        : p.reference}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
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

  const approver = limit?.approver.name.split(" ")[0] ?? "your supervisor";
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
      width={540}
      icon="app/icon-shield-brand-22"
      tone="brand"
      title={limit ? `Bar ${limit.requested} SIMs on this Ghana Card?` : "Checking SIMs on this Ghana Card…"}
      description={limit ? `${limit.requested} SIMs are registered to the same Ghana Card. ${limit.requested - 2} activated this month. You can bar up to ${limit.limit} per case.` : undefined}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" disabled={!limit} loading={busy} onClick={go} iconLeft={<Icon name="app/icon-escalate-white-18" size={18} />}>
            {choice === "escalate" ? `Escalate to ${approver}` : `Bar ${limit?.limit ?? 10} & escalate`}
          </Button>
        </>
      }
    >
      {limit && (
        <>
          <Banner tone="warning" title={`${limit.requested} is over your limit of ${limit.limit}`}>
            Ask {approver} to lift the limit, or bar the {limit.limit} most active now.
          </Banner>
          <div className="flex flex-col gap-2">
            <OptionCard name="bar" checked={choice === "escalate"} onChange={() => setChoice("escalate")} title={`Escalate to ${approver} for all ${limit.requested}`} description="Request is pre-filled with the SIM list." indent />
            <OptionCard name="bar" checked={choice === "partial"} onChange={() => setChoice("partial")} title={`Bar the ${limit.limit} most active now`} description={`Then escalate the remaining ${limit.requested - limit.limit}.`} indent />
          </div>
        </>
      )}
      <RequestError error={failure} />
    </Modal>
  );
}
