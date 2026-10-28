"use client";

import { RequestError } from "@/components/auth/RequestError";
import { SeverityBadge, riskTone } from "@/components/app/indicators";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, TextArea } from "@/components/ui/TextField";
import { fraudTypeLabel, type CaseSummary } from "@/lib/api/fd";
import type { User } from "@/lib/auth/api";
import { submitHandover, type HandoverChoice, type SubmittedHandover } from "@/lib/api/local";
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
  keep_tomorrow: "Keep: finish tomorrow",
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

/** A5 · Hand over shift — one choice per open case and a note for the next shift (POST /handovers/shift). */
export function HandoverModal({
  open,
  onClose,
  cases,
  next,
  resolvedToday,
  previous,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  cases: CaseSummary[];
  next: NonNullable<User["next_shift"]>;
  resolvedToday?: number;
  /** Today’s handover, when editing it (A6 · Edit handover). */
  previous?: SubmittedHandover | null;
  onSubmitted: (handover: SubmittedHandover) => void;
}) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      cases.map((c) => {
        // Records stored by older builds may lack `cases`.
        const sent = previous?.cases?.find((x) => x.case_id === c.id)?.choice;
        return [c.id, sent === "hand_over" ? "hand" : sent === "keep" ? "keep" : defaultChoice(c)];
      }),
    ),
  );
  const [note, setNote] = useState(previous?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const choiceFor = (c: CaseSummary) => choices[c.id] ?? defaultChoice(c);
  const handed = cases.filter((c) => choiceFor(c) === "hand");
  const first = next.user.name.split(" ")[0];
  const startsAt = Number.isNaN(Date.parse(next.starts_at)) ? null : formatClock(next.starts_at);

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

  const meta = [
    startsAt ? `${next.user.name} takes over at ${startsAt}` : `${next.user.name} takes over next`,
    resolvedToday !== undefined && `${resolvedToday} resolved today`,
    `${cases.length} open`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title="Hand over your shift"
      description={meta}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={submitting}>
            {handed.length ? `Hand over ${handed.length} ${handed.length === 1 ? "case" : "cases"}` : "Send handover note"}
          </Button>
        </>
      }
    >
      <RequestError error={failure} />

      {cases.length > 0 && (
        <ul className="-mt-2 flex flex-col">
          {cases.map((c) => (
            /* Handover case row (1319:173886) */
            <li key={c.id} className="flex items-center gap-3 border-b border-border-default py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="font-mono text-mono-m text-text-primary">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-body-s text-text-secondary">{fraudTypeLabel(c.fraud_type)}</span>
                <SeverityBadge severity={riskTone(c.risk_score)} />
              </div>
              <Select
                aria-label={`What happens to ${c.id}`}
                value={choiceFor(c)}
                onChange={(e) => setChoices((prev) => ({ ...prev, [c.id]: e.target.value as Choice }))}
                className="w-[212px] shrink-0"
              >
                <option value="hand">Hand to {first}</option>
                {(Object.keys(KEEP_LABELS) as Array<keyof typeof KEEP_LABELS>).map((k) => (
                  <option key={k} value={k}>
                    {KEEP_LABELS[k]}
                  </option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      )}

      <TextArea
        label={`Note for ${first}`}
        name="handover-note"
        rows={4}
        placeholder="What should they know first?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  );
}
