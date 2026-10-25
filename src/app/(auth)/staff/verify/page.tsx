"use client";

import { AuthHeading, AuthPage, DividerWithText, StaffBadge } from "@/components/auth/AuthPage";
import { Button, Spinner } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OtpInput } from "@/components/ui/OtpInput";
import { verifyStaffCode } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/** F2 · Staff second factor. TODO: no staff endpoints in the API yet (local). */
export default function StaffVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [failures, setFailures] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  useResetOnHide(() => setSubmitting(false));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await verifyStaffCode(code);
    setSubmitting(false);
    if (ok) router.push("/staff/workspaces");
    else {
      setError(true);
      setFailures((n) => n + 1);
    }
  };

  return (
    <AuthPage variant="staff">
      <StaffBadge />
      <AuthHeading
        icon={{ name: "icon-fingerprint-brand", tone: "brand" }}
        title="Confirm it’s you"
        description="Touch your security key, or enter a code from your authenticator app."
      />

      {/* TODO: start a WebAuthn assertion (navigator.credentials.get) once the server issues challenges. */}
      <div
        role="status"
        className="flex w-full items-center gap-3.5 rounded-xl bg-brand-primary-subtle px-[18px] py-4"
      >
        <Spinner tone="brand" />
        <div className="flex flex-col gap-0.5">
          <p className="text-label-m text-text-brand">Waiting for your security key…</p>
          <p className="text-body-s text-text-secondary">Insert it and touch the button.</p>
        </div>
      </div>

      <DividerWithText>or use your authenticator</DividerWithText>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(false);
          }}
          error={error}
          errorKey={failures}
          aria-label="Code from your authenticator app"
        />
        {error && (
          <p role="alert" className="flex items-start gap-2 text-body-s text-critical-fg">
            <Icon name="icon-alert-circle-critical" size={16} className="mt-0.5 shrink-0" />
            That code didn’t work. Codes change every 30 seconds. Enter the newest one.
          </p>
        )}
        <Button type="submit" fullWidth disabled={code.length < 6} loading={submitting}>
          Verify
        </Button>
      </form>
    </AuthPage>
  );
}
