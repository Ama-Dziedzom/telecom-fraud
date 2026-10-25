"use client";

import { AccountChip, AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useSignIn } from "@/components/auth/SignInContext";
import { Note } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/components/ui/PasswordField";
import { ApiError, checkPassword, identify } from "@/lib/auth/api";
import { signedInAccount, useSignedInAccount } from "@/lib/auth/session";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

function SignedOutInactiveContent() {
  const router = useRouter();
  const params = useSearchParams();
  const caseId = params.get("case"); // e.g. FD-3050
  const hasDraft = params.get("draft") === "1";
  const { update } = useSignIn();
  const account = useSignedInAccount();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useResetOnHide(() => {
    setSubmitting(false);
    setPassword("");
  });

  useEffect(() => {
    if (!signedInAccount()) router.replace("/sign-in");
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setSubmitting(true);
    setFailure(null);
    try {
      // Same three steps as a fresh sign-in, starting from the remembered email.
      const who = await identify(account);
      update({ email: who.email, operator: who.operator, method: who.next, redirectUrl: who.redirect_url ?? null });
      if (who.next === "sso") return router.push("/sign-in/sso");
      const result = await checkPassword(who.flow_id, password);
      update({ flowId: result.flow_id });
      router.push(result.next === "mfa_enroll" ? "/sign-in/set-up-authenticator" : "/sign-in/verify");
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) return setFailure(err);
      if (err.code === "invalid_credentials") return setError("That password isn’t right.");
      if (err.code === "account_locked") {
        update({ email: account, lockedUntil: Date.parse(String(err.problem.locked_until)) || null });
        return router.push("/sign-in/locked");
      }
      if (err.code === "password_expired") {
        update({ email: account, resetToken: String(err.problem.reset_token ?? "") || null });
        return router.push("/password-expired");
      }
      setFailure(err);
    }
  };

  if (!account) return null;

  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-clock", tone: "neutral" }}
        title="You were signed out"
        description="For security, sessions end after 15 minutes without activity. Sign in again to pick up where you left off."
      />

      <AccountChip email={account} changeHref="/sign-in" />

      <RequestError error={failure} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="email" name="username" value={account} autoComplete="username" readOnly hidden />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          error={error}
        />
        <Button
          type="submit"
          fullWidth
          loading={submitting}
          iconRight={<Icon name="icon-arrow-right" size={20} />}
        >
          {caseId ? `Sign in and return to ${caseId}` : "Sign in"}
        </Button>
      </form>

      {hasDraft && caseId && (
        <Note tone="success">Your unsent note on case {caseId} was saved as a draft.</Note>
      )}
    </AuthPage>
  );
}

/** E3 · Signed out after inactivity */
export default function SignedOutInactivePage() {
  return (
    <Suspense>
      <SignedOutInactiveContent />
    </Suspense>
  );
}
