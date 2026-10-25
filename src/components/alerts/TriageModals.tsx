"use client";

import { RequestError } from "@/components/auth/RequestError";
import { useStepUp } from "@/components/app/StepUp";
import { Banner } from "@/components/ui/Banner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCard, Checkbox, OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, Select, TextArea, TextField } from "@/components/ui/TextField";
import { apiFetch } from "@/lib/api/client";
import {
  useCaseSuggestions,
  useMyCases,
  type Alert,
  type AlertDetail,
  type BulkTriageResult,
  type ProtectiveAction,
  type Subscriber,
} from "@/lib/api/fd";
import { formatMoney } from "@/lib/time";
import { useState, type FormEvent } from "react";

type Base = { alert: Alert; open: boolean; onClose: () => void };
/** Bulk triage: the same decision for these alerts as well (B15). */
type WithOthers = { others?: Alert[] };

/** Runs a submit with busy + error state, so every modal behaves the same. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const submit = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await fn();
    } catch (err) {
      if (!(err instanceof Error && err.message === "step_up_cancelled")) setFailure(err);
    } finally {
      setBusy(false);
    }
  };
  return { busy, failure, submit };
}

// ─── B8 · Dismiss · needs a reason ────────────────────────────────────────

const DISMISS_REASONS = [
  { id: "legitimate_activity", title: "Legitimate: known customer behaviour", hint: "e.g. salary day, school fees, business owner", toast: "legitimate behaviour" },
  { id: "duplicate", title: "Duplicate of another alert", toast: "duplicate" },
  { id: "system_noise", title: "System or test noise", toast: "system noise" },
  { id: "insufficient_evidence", title: "Not enough evidence: keep watching", hint: "Adds the number to a 7-day watchlist", toast: "not enough evidence (watching 7 days)" },
] as const;
export type DismissReason = (typeof DISMISS_REASONS)[number]["id"];
export const dismissReasonLabel = (id: string) => DISMISS_REASONS.find((r) => r.id === id)?.toast ?? id;

export function DismissModal({
  alert,
  others = [],
  open,
  onClose,
  onDone,
}: Base & WithOthers & {
  /** `result` is set for bulk triage, which can leave some alerts out. */
  onDone: (reason: DismissReason, feedback: boolean, result?: BulkTriageResult) => void;
}) {
  const [reason, setReason] = useState<DismissReason | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState(true);
  const [tried, setTried] = useState(false);
  const { busy, failure, submit } = useSubmit();
  const rule = alert.rule_ids[0];
  const all = [alert, ...others];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!reason) return;
    void submit(async () => {
      if (others.length) {
        // TODO(api): POST /alerts/bulk takes no note or rule_feedback for dismissals yet.
        const result = await apiFetch<BulkTriageResult>("POST", "/alerts/bulk", {
          alert_ids: all.map((a) => a.id),
          action: "dismiss",
          reason,
        });
        onDone(reason, feedback, result);
      } else {
        await apiFetch("POST", `/alerts/${alert.id}/dismiss`, { reason, note: note || undefined, rule_feedback: feedback });
        onDone(reason, feedback);
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={others.length ? `Dismiss ${all.length} alerts?` : `Dismiss ${alert.id}?`}
      description={
        others.length
          ? `${all.map((a) => a.id).join(", ")} · your supervisor may review dismissals`
          : `${alert.title} · ${alert.subscriber.msisdn} · your supervisor may review dismissals`
      }
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" type="submit" form="dismiss-form" loading={busy}>
            {others.length ? `Dismiss ${all.length} alerts` : "Dismiss alert"}
          </Button>
        </>
      }
    >
      <form id="dismiss-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2">
            <FieldLabel required>Why is this a false alarm?</FieldLabel>
          </legend>
          {DISMISS_REASONS.map((r) => (
            <OptionCard
              key={r.id}
              name="dismiss-reason"
              value={r.id}
              checked={reason === r.id}
              onChange={() => setReason(r.id)}
              title={r.title}
              description={"hint" in r ? r.hint : undefined}
              invalid={tried && !reason}
              indent
            />
          ))}
          {tried && !reason && (
            <p role="alert" className="flex items-center gap-1.5 text-caption text-critical-fg">
              <Icon name="icon-alert-critical" size={14} />
              Choose a reason so we can improve rule {rule}.
            </p>
          )}
        </fieldset>
        <TextArea label="Note" optional placeholder="What did you check?" value={note} onChange={(e) => setNote(e.target.value)} />
        <Checkbox
          label={`Send feedback to the rule owner (${Array.from(new Set(all.flatMap((a) => a.rule_ids))).join(", ")})`}
          checked={feedback}
          onChange={(e) => setFeedback(e.target.checked)}
        />
        <RequestError error={failure} />
      </form>
    </Modal>
  );
}

// ─── B10 · Open a case from the alert ─────────────────────────────────────

const CASE_TYPES = [
  ["momo_velocity", "MoMo fraud · velocity"],
  ["sim_swap_to_momo", "SIM swap to MoMo"],
  ["account_takeover", "Account takeover"],
  ["sim_box_bypass", "Bypass (SIM box)"],
  ["agent_cash_out", "Agent cash-out"],
  ["wangiri", "Wangiri"],
  ["other", "Other"],
] as const;

export function PromoteModal({
  alert,
  open,
  onClose,
  related,
  relatedTitle,
  me,
  onDone,
}: Base & {
  related: Alert[];
  /** Overrides “N earlier alerts on +233 …” (bulk: “3 more selected alerts”). */
  relatedTitle?: string;
  me: { name: string; shift?: string } | null;
  onDone: (caseId: string, linked: number) => void;
}) {
  const { data: mine } = useMyCases();
  const [fraudType, setFraudType] = useState<string>(alert.fraud_type);
  const [priority, setPriority] = useState<string>(alert.severity === "low" ? "medium" : alert.severity);
  const [assign, setAssign] = useState<"me" | "team">("me");
  const [include, setInclude] = useState(related.length > 0);
  const [note, setNote] = useState("");
  const { busy, failure, submit } = useSubmit();
  const shiftEnd = me?.shift?.split("-")[1];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(async () => {
      // TODO(api): 0.2 documents only `note` on promote; the type, priority, assignee and linked alerts are proposed.
      const created = await apiFetch<{ id: string }>("POST", `/alerts/${alert.id}/promote`, {
        note: note || undefined,
        fraud_type: fraudType,
        priority,
        assign_to: assign,
        include_alert_ids: include ? related.map((a) => a.id) : [],
      });
      onDone(created.id, include ? related.length : 0);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title={`Open a case from ${alert.id}`}
      description={`${alert.title} · ${alert.subscriber.msisdn} · ${alert.region}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" type="submit" form="promote-form" loading={busy} iconLeft={<Icon name="app/icon-plus-white-18" size={18} />}>
            Open case
          </Button>
        </>
      }
    >
      <form id="promote-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex gap-4">
          <Select label="Case type" value={fraudType} onChange={(e) => setFraudType(e.target.value)}>
            {CASE_TYPES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            iconLeft={<Icon name="icon-alert-triangle-medium" size={16} />}
          >
            {["critical", "high", "medium"].map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
                {p === alert.severity ? ` (from risk ${alert.risk_score})` : ""}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2">
            <FieldLabel>Assign to</FieldLabel>
          </legend>
          <OptionCard
            name="assign"
            checked={assign === "me"}
            onChange={() => setAssign("me")}
            title={`Me: ${me?.name ?? "you"}`}
            description={[mine && `${mine.data.length} open cases`, shiftEnd && `on shift until ${shiftEnd}`].filter(Boolean).join(" · ")}
            indent
          />
          <OptionCard
            name="assign"
            checked={assign === "team"}
            onChange={() => setAssign("team")}
            title="Leave in the team queue"
            description="Anyone on shift can pick it up"
            indent
          />
        </fieldset>
        {related.length > 0 && (
          <div className="flex flex-col gap-2">
            <FieldLabel>Also include</FieldLabel>
            <CheckCard
              checked={include}
              onChange={(e) => setInclude(e.target.checked)}
              title={relatedTitle ?? `${related.length} earlier ${related.length === 1 ? "alert" : "alerts"} on ${alert.subscriber.msisdn}`}
              description={related.map((a) => `${a.id} · ${a.title}`).join(" · ")}
            />
          </div>
        )}
        <TextArea label="First note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should whoever picks it up know first?" />
        <RequestError error={failure} />
      </form>
    </Modal>
  );
}

// ─── B12 · Add to an existing case ────────────────────────────────────────

const STRENGTH = {
  suggested: { label: "Suggested", tone: "brand" as const },
  possible: { label: "Possible", tone: "neutral" as const },
  weak: { label: "Weak", tone: "neutral" as const },
};

export function AttachModal({
  alert,
  others = [],
  open,
  onClose,
  onDone,
}: Base & WithOthers & { onDone: (caseId: string, result?: BulkTriageResult) => void }) {
  const { data: suggestions } = useCaseSuggestions(open ? alert.id : null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const { busy, failure, submit } = useSubmit();
  const list = (suggestions?.data ?? []).filter((s) => {
    const q = query.trim().toLowerCase();
    return !q || `${s.case.id} ${s.case.title} ${s.case.assignee?.name ?? ""}`.toLowerCase().includes(q);
  });
  const caseId = picked ?? suggestions?.data.find((s) => s.strength === "suggested")?.case.id ?? null;
  // A typed case ID that isn’t suggested can still be used directly.
  const typedId = /^FD-\d+$/i.test(query.trim()) ? query.trim().toUpperCase() : null;
  const target = list.length === 0 && typedId ? typedId : caseId;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    void submit(async () => {
      if (others.length) {
        const result = await apiFetch<BulkTriageResult>("POST", "/alerts/bulk", {
          alert_ids: [alert, ...others].map((a) => a.id),
          action: "attach",
          case_id: target,
        });
        onDone(target, result);
      } else {
        await apiFetch("POST", `/alerts/${alert.id}/attach`, { case_id: target, note: note || undefined });
        onDone(target);
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title={others.length ? `Add ${others.length + 1} alerts to a case` : `Add ${alert.id} to a case`}
      description={others.length ? [alert, ...others].map((a) => a.id).join(", ") : `${alert.title} · ${alert.subscriber.msisdn}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            type="submit"
            form="attach-form"
            loading={busy}
            disabled={!target}
            iconLeft={<Icon name="app/icon-folder-white-18" size={18} />}
          >
            {target ? `Add to ${target}` : "Add to case"}
          </Button>
        </>
      }
    >
      <form id="attach-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        <TextField
          size="md"
          type="search"
          aria-label="Search cases"
          placeholder="Search by case ID, MSISDN or analyst"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          iconLeft={<Icon name="app/icon-search-18" size={18} />}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2">
            <FieldLabel>{query ? "Matching cases" : "Suggested for this alert"}</FieldLabel>
          </legend>
          {list.map((s) => (
            <OptionCard
              key={s.case.id}
              name="attach-case"
              checked={caseId === s.case.id}
              onChange={() => setPicked(s.case.id)}
              title={
                <>
                  <span className="font-mono text-mono-m">{s.case.id}</span> · {s.case.title}
                  {s.case.assignee ? ` · ${s.case.assignee.name}` : ""}
                </>
              }
              badge={<Badge label={STRENGTH[s.strength].label} tone={STRENGTH[s.strength].tone} />}
              description={`Match: ${s.reason}`}
              indent
            />
          ))}
          {list.length === 0 && (
            <p className="text-body-s text-text-secondary">
              {typedId ? `No suggestion matches; the alert will be added to ${typedId}.` : "No open case matches. Try a case ID like FD-3047."}
            </p>
          )}
        </fieldset>
        <TextArea label="Why are you adding it?" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <RequestError error={failure} />
      </form>
    </Modal>
  );
}

// ─── B13/B14 · Protect now ────────────────────────────────────────────────

export type ProtectKind = "freeze_wallet" | "suspend_sim" | "block_recipients" | "send_safety_sms";

export const PROTECT_REASONS = [
  ["suspected_account_takeover", "Suspected account takeover: new device"],
  ["suspected_sim_swap", "Suspected SIM swap fraud"],
  ["mule_activity", "Money moving to mule wallets"],
  ["subscriber_request", "Subscriber asked us to block"],
] as const;

/** What each protective action means for this subscriber, in plain words. */
export function protectOptions(detail: AlertDetail | undefined, sub: Subscriber | undefined, newRecipients: number) {
  const balance = sub ? formatMoney(sub.wallet.balance.amount_minor, sub.wallet.balance.currency, { decimals: true }) : null;
  const swapped = Boolean(sub?.sim.last_swap_at && detail && Date.parse(detail.created_at) - Date.parse(sub.sim.last_swap_at) < 7 * 86_400_000);
  return {
    freeze_wallet: {
      icon: "app/icon-wallet-18",
      title: "Freeze MoMo wallet",
      menu: `Blocks transfers and cash-outs.${balance ? ` Balance ${balance} is held.` : ""}`,
      confirm: `${balance ? `${balance} held · ` : ""}no transfers or cash-outs`,
      recommended: true,
    },
    suspend_sim: {
      icon: "app/icon-sim-18",
      title: "Suspend SIM",
      menu: "Blocks calls, SMS and USSD until re-verified in branch.",
      confirm: swapped ? "Blocks calls, SMS and USSD until re-verified in branch" : "Not needed: no SIM swap detected",
      recommended: swapped,
    },
    block_recipients: {
      icon: "app/icon-ban-18",
      title: newRecipients ? `Block ${newRecipients} recipient wallets` : "Block recipient wallets",
      menu: "Adds the new recipients to the watchlist for 30 days.",
      confirm: "Watchlist for 30 days",
      recommended: newRecipients > 0,
    },
    send_safety_sms: {
      icon: "app/icon-send-18",
      title: "Send safety SMS to alternate number",
      menu: "“Did you make these payments? Call 100.”",
      confirm: sub ? `To ${sub.contact.alt_msisdn}` : "To the alternate number on file",
      recommended: false,
    },
  } satisfies Record<ProtectKind, { icon: string; title: string; menu: string; confirm: string; recommended: boolean }>;
}

const CONFIRM_VERB: Record<ProtectKind, string> = {
  freeze_wallet: "Freeze",
  suspend_sim: "Suspend",
  block_recipients: "block",
  send_safety_sms: "SMS",
};

export function ProtectModal({
  alert,
  open,
  onClose,
  initial,
  options,
  recipients,
  relatedCount,
  nextCaseId,
  onDone,
}: Base & {
  initial: ProtectKind[];
  options: ReturnType<typeof protectOptions>;
  recipients: string[];
  relatedCount: number;
  nextCaseId?: string;
  onDone: (result: { case: { id: string }; action: ProtectiveAction }) => void;
}) {
  const [picked, setPicked] = useState<Set<ProtectKind>>(() => new Set(initial));
  const [reason, setReason] = useState<string>(PROTECT_REASONS[0][0]);
  const [note, setNote] = useState("");
  const { busy, failure, submit } = useSubmit();
  const stepUp = useStepUp();
  const kinds: ProtectKind[] = ["freeze_wallet", "block_recipients", "suspend_sim", "send_safety_sms"];
  const chosen = kinds.filter((k) => picked.has(k));
  const label = chosen.length
    ? `${chosen.slice(0, 2).map((k, i) => (i === 0 ? CONFIRM_VERB[k] : CONFIRM_VERB[k].toLowerCase())).join(" & ")}${chosen.length > 2 ? " & more" : ""} (${chosen.length})`
    : "Choose an action";
  const losesAccess = picked.has("freeze_wallet") || picked.has("suspend_sim");

  const toggle = (k: ProtectKind, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!chosen.length) return;
    void submit(async () => {
      const result = await stepUp(() =>
        apiFetch<{ case: { id: string }; action: ProtectiveAction }>("POST", `/alerts/${alert.id}/protect`, {
          parts: chosen.map((kind) =>
            kind === "block_recipients"
              ? { kind, targets: recipients, days: 30 }
              : { kind, target: alert.subscriber.subscriber_id },
          ),
          reason,
          note: note || undefined,
        }),
      );
      onDone(result);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={`Protect ${alert.subscriber.msisdn}`}
      description={`${alert.id} · ${alert.title}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            type="submit"
            form="protect-form"
            loading={busy}
            disabled={!chosen.length}
            iconLeft={<Icon name="app/icon-shield-white-18" size={18} />}
          >
            {label}
          </Button>
        </>
      }
    >
      <form id="protect-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          {kinds.map((k) => (
            <CheckCard
              key={k}
              checked={picked.has(k)}
              onChange={(e) => toggle(k, e.target.checked)}
              title={options[k].title}
              description={options[k].confirm}
            />
          ))}
        </div>
        <Select label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)}>
          {PROTECT_REASONS.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </Select>
        <TextArea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        {!alert.case_id && (
          <Banner tone="info" title={`This also opens ${nextCaseId ? `case ${nextCaseId}` : "a case"}, assigned to you`}>
            {alert.id}
            {relatedCount ? ` and ${relatedCount === 1 ? "the earlier alert" : `${relatedCount} earlier alerts`}` : ""} will be
            linked to it.
          </Banner>
        )}
        {losesAccess && (
          <Banner tone="warning" title={picked.has("freeze_wallet") ? "The subscriber will lose MoMo access" : "The subscriber will lose service"}>
            They’ll need to visit a branch with their Ghana Card. A supervisor can undo this.
          </Banner>
        )}
        <RequestError error={failure} />
      </form>
    </Modal>
  );
}

/** “1 earlier alert on +233 …” — open alerts on the same subscriber, newest first. */
export function relatedAlerts(alert: Alert, all: Alert[]) {
  return all.filter(
    (a) => a.id !== alert.id && a.subscriber.subscriber_id === alert.subscriber.subscriber_id && a.status !== "dismissed",
  );
}

