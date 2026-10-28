"use client";

import { RequestError } from "@/components/auth/RequestError";
import { useStepUp } from "@/components/app/StepUp";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Select, TextArea } from "@/components/ui/TextField";
import { reveal, type RevealReason } from "@/lib/api/reveal";
import { useState } from "react";

const REASONS: Array<[RevealReason, string]> = [
  ["investigating_case", "Investigating an open case"],
  ["call_subscriber_back", "Confirming identity on a call"],
  ["regulator_request", "Regulator or police request"],
];
/** “confirm identity on a call”, for the C15 banner (“You revealed them to …”). */
const PURPOSE: Record<RevealReason, string> = {
  investigating_case: "investigate an open case",
  call_subscriber_back: "confirm identity on a call",
  regulator_request: "answer a regulator or police request",
};
export const revealPurpose = (reason: RevealReason) => PURPOSE[reason] ?? reason.replace(/_/g, " ");
/** “investigating an open case” */
export const revealReasonLabel = (reason: RevealReason) => (REASONS.find(([id]) => id === reason)?.[1] ?? reason.replace(/_/g, " ")).toLowerCase();

/**
 * C14 · Reveal personal details — a reason is required, it’s logged and
 * visible to the supervisor, and details show for 15 minutes. An open case
 * goes with the request (the first in `cases`).
 */
export function RevealModal({
  open,
  onClose,
  subscriber,
  cases,
  onRevealed,
}: {
  open: boolean;
  onClose: () => void;
  /** `msisdn` (masked) completes the sub-line: “Kojo M. · 054 *** 3457”. */
  subscriber: { id: string; name: string; msisdn?: string };
  cases: Array<{ id: string; title: string }>;
  onRevealed?: () => void;
}) {
  const stepUp = useStepUp();
  const [reason, setReason] = useState<RevealReason | "">("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const missing = tried && !reason;

  const submit = async () => {
    setTried(true);
    if (!reason) return;
    setBusy(true);
    setFailure(null);
    try {
      await stepUp(() => reveal(subscriber.id, { reason, case_id: cases[0]?.id, note: note || undefined }));
      onRevealed?.();
      onClose();
    } catch (err) {
      if (!(err instanceof Error && err.message === "step_up_cancelled")) setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      title="Reveal personal details"
      description={[subscriber.name, subscriber.msisdn].filter(Boolean).join(" · ")}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={busy}>
            Reveal for 15 min
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Select
          label="Reason"
          value={reason}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? "reveal-reason-error" : undefined}
          onChange={(e) => setReason(e.target.value as RevealReason)}
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {REASONS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        {missing && (
          <p id="reveal-reason-error" role="alert" className="flex items-center gap-1.5 text-caption text-critical-fg">
            <Icon name="app/icon-alert-circle-critical-14" size={14} />
            Choose a reason to reveal
          </p>
        )}
      </div>
      <TextArea label="Note" optional rows={3} placeholder="What do you need it for?" value={note} onChange={(e) => setNote(e.target.value)} />
      <Banner tone="info" title="Logged and visible to your supervisor">
        Details show for 15 min, then hide again.
      </Banner>
      <RequestError error={failure} />
    </Modal>
  );
}
