"use client";

import { AccountChip, AuthHeading, AuthPage, StepOverline } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useSignIn } from "@/components/auth/SignInContext";
import { useInvite } from "@/components/auth/useInvite";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/components/ui/PasswordField";
import { PasswordRules, StrengthMeter } from "@/components/ui/PasswordRules";
import { TextField } from "@/components/ui/TextField";
import { acceptInvite, ApiError, requestNewInvite, roleLabel } from "@/lib/auth/api";
import { evaluatePassword, passwordStrength, personalWords } from "@/lib/password";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/** akosua.frimpong@… → “Akosua Frimpong” as a starting point for the name field. */
function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/** C2 · Create password (+ C3 password problems) — or C7 when the invite can’t be used */
export default function CreatePasswordPage() {
  const router = useRouter();
  const invite = useInvite();
  const { update } = useSignIn();
  const [name, setName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useResetOnHide(() => setSubmitting(false));

  if (invite.status === "loading") return null;
  if (invite.status === "unusable") {
    return <InviteUnusable {...invite} />;
  }
  if (invite.status === "failed") {
    return (
      <AuthPage>
        <RequestError error={invite.error} />
      </AuthPage>
    );
  }

  const { email, role, operator } = invite.invite;
  const fullName = name ?? nameFromEmail(email);
  const personal = personalWords(email, fullName);
  const rules = evaluatePassword(password, { personal, showFailures: attempted });
  const strength = passwordStrength(password, personal);
  const mismatch = attempted && confirm !== password;
  const passwordInvalid = rules.some((r) => r.state !== "met");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (passwordInvalid || confirm !== password || !fullName.trim()) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const result = await acceptInvite(invite.token, fullName.trim(), password);
      update({ email, flowId: result.flow_id, operator, method: "password" });
      router.push(`/invite/${invite.token}/authenticator`);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.code === "weak_password") {
        setServerError(err.problem.errors?.[0]?.message ?? err.problem.detail ?? "Choose a stronger password.");
      } else {
        setFailure(err);
      }
    }
  };

  return (
    <AuthPage width={420} gap={28}>
      <AuthHeading
        above={<StepOverline>Step 1 of 3 · Password</StepOverline>}
        title="Create your account"
        description={`You’ve been invited as a ${roleLabel(role)} at ${operator.name}.`}
      />

      <AccountChip email={email} />

      <RequestError error={failure} />

      <form id="create-password" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        {/* Not in the C2 design: the accept-invite endpoint requires a name. */}
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setName(e.target.value)}
        />
        <PasswordField
          label="Create password"
          name="new-password"
          autoComplete="new-password"
          required
          autoFocus
          placeholder="••••••••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setServerError(null);
          }}
          invalid={attempted && passwordInvalid}
          error={serverError}
        />
        <StrengthMeter strength={strength} empty={!password} />
        <PasswordRules rules={rules} />
        <PasswordField
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          required
          placeholder="••••••••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords don’t match." : undefined}
        />
      </form>

      <Button
        type="submit"
        form="create-password"
        fullWidth
        loading={submitting}
        iconRight={<Icon name="icon-arrow-right" size={20} />}
      >
        Continue
      </Button>
    </AuthPage>
  );
}

/** C7 · Invite expired (410), or already used (409) — wording from the API. */
function InviteUnusable({
  token,
  reason,
  title,
  detail,
}: {
  token: string;
  reason: "expired" | "used";
  title: string;
  detail?: string;
}) {
  const [sent, setSent] = useState(false);
  return (
    <AuthPage>
      <AuthHeading icon={{ name: "icon-clock", tone: "neutral" }} title={title} description={detail} />
      <div className="flex flex-col gap-3">
        {reason === "expired" && (
          // TODO: no endpoint to request a new invite yet; this only confirms locally.
          <Button
            fullWidth
            disabled={sent}
            onClick={async () => {
              await requestNewInvite(token);
              setSent(true);
            }}
            iconLeft={<Icon name="icon-send-white" size={20} />}
          >
            {sent ? "Request sent" : "Ask for a new invite"}
          </Button>
        )}
        <ButtonLink href="/sign-in" variant={reason === "used" ? "primary" : "secondary"} fullWidth>
          {reason === "used" ? "Sign in" : "Back to sign in"}
        </ButtonLink>
      </div>
    </AuthPage>
  );
}
