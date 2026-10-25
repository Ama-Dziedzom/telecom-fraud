"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { useRequireFlow } from "@/components/auth/SignInContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { requestAccess } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/** B4 · Signed in, but no account here. TODO: no endpoint in the API yet (request is local). */
export default function SsoNoAccountPage() {
  const router = useRouter();
  const { email, operator, ready } = useRequireFlow();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useResetOnHide(() => setSubmitting(false));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await requestAccess(email, reason);
    router.push("/sign-in/sso/requested");
  };

  if (!ready || !operator) return null;

  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-user", tone: "neutral" }}
        title="You don’t have access yet"
        description={`You signed in to ${operator.name} as ${email}, but no FraudDetection account is linked to it.`}
      />

      <form id="request-access" onSubmit={handleSubmit}>
        <TextField
          label="Why do you need access? (optional)"
          name="reason"
          placeholder="e.g. New Fraud Analyst, Accra team"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </form>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          form="request-access"
          fullWidth
          loading={submitting}
          iconLeft={<Icon name="icon-send-white" size={20} />}
        >
          Request access from IT admin
        </Button>
        <ButtonLink
          href="/sign-in"
          variant="secondary"
          fullWidth
          iconLeft={<Icon name="icon-log-out" size={20} />}
        >
          Sign out of company account
        </ButtonLink>
      </div>
    </AuthPage>
  );
}
