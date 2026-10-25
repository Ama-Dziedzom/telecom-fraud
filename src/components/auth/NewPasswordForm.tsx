"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { PasswordRules } from "@/components/ui/PasswordRules";
import { ApiError, resetPassword } from "@/lib/auth/api";
import { evaluatePassword } from "@/lib/password";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/**
 * New password + confirm, sent to POST /auth/password/reset with a token
 * (D3 from the email link, E1 from 403 password_expired).
 */
export function NewPasswordForm({
  token,
  submitLabel,
  signedOutNotice = false,
  onDone,
  onExpired,
}: {
  token: string;
  submitLabel: string;
  signedOutNotice?: boolean;
  onDone: () => void;
  onExpired: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useResetOnHide(() => setSubmitting(false));

  const rules = evaluatePassword(password, { checkHistory: true, showFailures: attempted });
  const mismatch = attempted && confirm !== password;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);
    const characterRulesMet = rules.filter((r) => r.id !== "history").every((r) => r.state === "met");
    if (!characterRulesMet || confirm !== password) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await resetPassword(token, password);
      onDone();
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.code === "link_expired") return onExpired();
      if (err instanceof ApiError && err.code === "weak_password") {
        // Covers “not one of your last 5 passwords”, which only the server can check.
        return setServerError(
          err.problem.errors?.[0]?.message ?? err.problem.detail ?? "Choose a stronger password.",
        );
      }
      setFailure(err);
    }
  };

  return (
    <>
      <RequestError error={failure} />
      <form id="new-password" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <PasswordField
          label="New password"
          name="new-password"
          autoComplete="new-password"
          required
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setServerError(null);
          }}
          invalid={rules.some((r) => r.state === "failed")}
          error={serverError}
        />
        <PasswordRules rules={rules} />
        <PasswordField
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          required
          placeholder="Re-enter new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords don’t match." : undefined}
        />
      </form>
      {signedOutNotice && <Banner tone="info" title="You’ll be signed out everywhere else" />}
      <Button type="submit" form="new-password" fullWidth loading={submitting}>
        {submitLabel}
      </Button>
    </>
  );
}
