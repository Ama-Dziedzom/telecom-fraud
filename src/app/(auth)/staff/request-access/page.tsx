"use client";

import { AuthHeading, AuthPage, StaffBadge } from "@/components/auth/AuthPage";
import { OperatorLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { requestSupportAccess } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

const DURATIONS = ["30 minutes", "1 hour", "2 hours", "4 hours", "8 hours"];

/** F4 · Request support access. TODO: no endpoint in the API yet (local). */
export default function RequestSupportAccessPage() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("2 hours");
  const [readOnly, setReadOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useResetOnHide(() => setSubmitting(false));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await requestSupportAccess(`${reason} · ${duration} · ${readOnly ? "read-only" : "read-write"}`);
    router.push("/staff/workspaces");
  };

  return (
    <AuthPage variant="staff" back={{ href: "/staff/workspaces", label: "Back to workspaces" }}>
      <StaffBadge />
      <AuthHeading
        above={<OperatorLogo operator="Kasa Mobile" />}
        title="Request access to Kasa Mobile"
        description="Kojo Asare (IT Admin) will be asked to approve. Access ends automatically when the time is up."
      />

      <form id="support-access" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <TextField
          label="Reason"
          name="reason"
          required
          autoFocus
          placeholder="Ticket number and what you’re investigating"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <SelectField
          label="How long do you need?"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          iconLeft={<Icon name="icon-clock-tertiary-18" size={18} />}
        >
          {DURATIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </SelectField>
        <Checkbox
          label="Read-only: I won’t change settings or cases"
          checked={readOnly}
          onChange={(e) => setReadOnly(e.target.checked)}
        />
      </form>

      <Button
        type="submit"
        form="support-access"
        fullWidth
        loading={submitting}
        iconLeft={<Icon name="icon-send-white" size={20} />}
      >
        Send request
      </Button>
    </AuthPage>
  );
}
