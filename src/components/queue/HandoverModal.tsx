"use client";

import { RequestError } from "@/components/auth/RequestError";
import { SeverityBadge, riskTone } from "@/components/app/indicators";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { fraudTypeLabel, type CaseSummary } from "@/lib/api/fd";
import type { User } from "@/lib/auth/api";
import { shiftName, submitHandover, type HandoverChoice, type SubmittedHandover } from "@/lib/api/local";
import { formatClock, now } from "@/lib/time";
import { useState } from "react";

type Choice = "hand" | "keep_supervisor" | "keep_tomorrow" | "keep_decision" | "keep";
/** The reasons for keeping a case are for the analyst; the API only hears “keep”. */
const SENT_AS: Record<Choice, HandoverChoice> = {
  hand: "hand_over",
  keep_supervisor: "keep",
  keep_tomorrow: "keep",
  keep_decision: "keep",
  keep: "keep",
};

const KEEP_LABELS: Record<Exclude<Choice, "hand">, string> = {
  keep_supervisor: "Keep: waiting on supervisor",
  keep_tomorrow: "Keep: I’ll fix tomorrow",
  keep_decision: "Keep: pending decision",
  keep: "Keep with me",
};

/** Sensible default per case: hand over active work, keep what waits on others. */
function defaultChoice(c: CaseSummary): Choice {
  if (c.status === "escalated") return "keep_supervisor";
  if (c.status === "sent_back") return "keep_tomorrow";
  if (c.status === "pending_decision") return "keep_decision";
  return "hand";
}

/** A5 · Hand over shift — one note and a choice per open case for the next shift (POST /handovers/shift). */
export function HandoverModal({
  open,
  onClose,
  cases,
  next,
  resolvedToday,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  cases: CaseSummary[];
  next: NonNullable<User["next_shift"]>;
  resolvedToday?: number;
  onSubmitted: (handover: SubmittedHandover) => void;
}) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(cases.map((c) => [c.id, defaultChoice(c)])),
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const choiceFor = (c: CaseSummary) => choices[c.id] ?? defaultChoice(c);
  const handed = cases.filter((c) => choiceFor(c) === "hand");
  const first = next.user.name.split(" ")[0];
  const startsAt = formatClock(next.starts_at);
  const nextShift = shiftName(next.shift);

  const submit = async () => {
    setSubmitting(true);
    setFailure(null);
    try {
      const handover = await submitHandover(
        {
          to_user_id: next.user.id,
          note: note || undefined,
          cases: cases.map((c) => ({ case_id: c.id, choice: SENT_AS[choiceFor(c)] })),
        },
        next.starts_at,
        now(),
      );
      onSubmitted(handover);
    } catch (err) {
      setFailure(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={720}
      icon="app/icon-users-brand-22"
      tone="brand"
      title="Hand over your shift"
      description={`${first} takes over at ${startsAt}. Handed-over cases move to their queue with your note.`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            onClick={submit}
            loading={submitting}
            iconLeft={<Icon name="app/icon-users-white-18" size={18} />}
          >
            {handed.length ? `Hand over ${handed.length} ${handed.length === 1 ? "case" : "cases"}` : "Send handover note"}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        {resolvedToday !== undefined && <Badge label={`${resolvedToday} resolved today`} tone="success" />}
        <Badge label={`${cases.length} open`} tone="neutral" />
        <Badge label={`${handed.length} handed to ${nextShift} shift`} tone="brand" />
      </div>

      <RequestError error={failure} />

      <ul className="flex flex-col rounded-xl border border-border-default">
        {cases.map((c) => {
          const choice = choiceFor(c);
          return (
            <li key={c.id} className="flex items-center gap-3 border-b border-border-subtle px-3.5 py-3 last:border-b-0">
              <span className="font-mono text-mono-m text-text-primary">{c.id}</span>
              <span className="truncate text-body-s text-text-secondary">{fraudTypeLabel(c.fraud_type)}</span>
              <SeverityBadge severity={riskTone(c.risk_score)} />
              <span className="flex-1" />
              <label className="relative flex h-9 w-[250px] shrink-0 items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-focus">
                <span className="sr-only">What happens to {c.id}</span>
                <Icon name={choice === "hand" ? "app/icon-users-secondary-16" : "app/icon-user-secondary-16"} size={16} />
                <select
                  value={choice}
                  onChange={(e) => setChoices((prev) => ({ ...prev, [c.id]: e.target.value as Choice }))}
                  className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-body-s text-text-primary outline-none focus-visible:shadow-none"
                >
                  <option value="hand">
                    Hand to {first} ({nextShift})
                  </option>
                  {(Object.keys(KEEP_LABELS) as Array<keyof typeof KEEP_LABELS>).map((k) => (
                    <option key={k} value={k}>
                      {KEEP_LABELS[k]}
                    </option>
                  ))}
                </select>
                <Icon name="app/icon-chevron-down-16" size={16} className="pointer-events-none shrink-0" />
              </label>
            </li>
          );
        })}
      </ul>

      <TextField
        label="Note for the next shift"
        name="handover-note"
        placeholder="What should they know first?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  );
}
