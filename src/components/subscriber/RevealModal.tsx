"use client";

import { RequestError } from "@/components/auth/RequestError";
import { useStepUp } from "@/components/app/StepUp";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Select, TextArea } from "@/components/ui/TextField";
import { reveal } from "@/lib/api/reveal";
import { useState } from "react";

const REASONS = [
  ["open_case", "Investigating an open case"],
  ["customer_contact", "Calling the subscriber back"],
  ["regulator_request", "Regulator or police request"],
] as const;

/** C14 · Reveal personal details — reason required, audited, visible for 15 minutes. */
export function RevealModal({
  open,
  onClose,
  subscriber,
  cases,
  onRevealed,
}: {
  open: boolean;
  onClose: () => void;
  subscriber: { id: string; name: string };
  cases: Array<{ id: string; title: string }>;
  onRevealed?: () => void;
}) {
  const stepUp = useStepUp();
  const [reason, setReason] = useState<string>(REASONS[0][0]);
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const needsCase = reason === "open_case";

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await stepUp(() => reveal(subscriber.id, { reason, case_id: needsCase ? caseId : undefined, note: note || undefined }));
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
      width={520}
      icon="app/icon-eye-brand-22"
      tone="brand"
      title="Reveal personal details?"
      description={`Full number, name, date of birth and Ghana Card number for ${subscriber.name}. This is logged against your name.`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            onClick={submit}
            loading={busy}
            disabled={needsCase && !caseId}
            iconLeft={<Icon name="app/icon-eye-white-18" size={18} />}
          >
            Reveal for 15 min
          </Button>
        </>
      }
    >
      <Select label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      {needsCase && (
        <Select
          label="Linked case"
          required
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          iconLeft={<Icon name="app/icon-folder-secondary-16" size={16} />}
        >
          {cases.length === 0 && <option value="">No open case on this subscriber</option>}
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · {c.title}
            </option>
          ))}
        </Select>
      )}
      <TextArea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <Banner tone="info" title="Visible for 15 minutes">
        Details mask again automatically, or when you leave this page.
      </Banner>
      <RequestError error={failure} />
    </Modal>
  );
}
