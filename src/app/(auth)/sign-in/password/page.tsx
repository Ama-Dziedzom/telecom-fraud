"use client";

import { AccountChip, AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useFlowExpired, useRequireFlow } from "@/components/auth/SignInContext";
import { OperatorLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { ApiError, checkPassword } from "@/lib/auth/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/** A4 · Password (+ A5 wrong password) */
export default function PasswordPage() {
  const router = useRouter();
  const { email, flowId, operator, ready, update } = useRequireFlow();
  const flowExpired = useFlowExpired();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useResetOnHide(() => {
    setSubmitting(false);
    setPassword("");
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!flowId) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const result = await checkPassword(flowId, password);
      update({ flowId: result.flow_id });
      router.push(result.next === "mfa_enroll" ? "/sign-in/set-up-authenticator" : "/sign-in/verify");
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) return setFailure(err);
      switch (err.code) {
        case "invalid_credentials": {
          const left = Number(err.problem.attempts_left);
          return setError(
            Number.isFinite(left)
              ? `That password isn’t right. ${left} ${left === 1 ? "attempt" : "attempts"} left before your account is locked for 15 minutes.`
              : "That password isn’t right.",
          );
        }
        case "account_locked":
          update({ lockedUntil: Date.parse(String(err.problem.locked_until)) || null });
          return router.push("/sign-in/locked");
        case "password_expired":
          update({ resetToken: String(err.problem.reset_token ?? "") || null });
          return router.push("/password-expired");
        case "flow_expired":
          return flowExpired(err.problem);
        default:
          return setFailure(err);
      }
    }
  };

  if (!ready) return null;

  return (
    <AuthPage back={{ href: "/sign-in" }}>
      <AuthHeading
        above={operator && <OperatorLogo operator={operator.name} />}
        title="Welcome back"
        description="Enter your password to continue."
      />

      <AccountChip email={email} changeHref="/sign-in" />

      <RequestError error={failure} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Hidden username so password managers pair the credentials. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <PasswordField
          label="Password"
          labelAction={
            <Link
              href="/forgot-password"
              className="rounded text-label-s text-text-brand hover:underline"
            >
              Forgot password?
            </Link>
          }
          name="password"
          autoComplete="current-password"
          required
          autoFocus
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          error={error}
        />
        <Button type="submit" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthPage>
  );
}
