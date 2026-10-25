"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { useRequireFlow } from "@/components/auth/SignInContext";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/Button";
import { ReferenceRow } from "@/components/ui/CopyButton";

/** D7 · Reset requested from IT admin. TODO: reference comes from the local stub. */
export default function ResetRequestedPage() {
  const { ready } = useRequireFlow();
  if (!ready) return null;
  const admin = "Your IT admin";

  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-send-success", tone: "success" }}
        title="Request sent to your IT admin"
        description={`${admin} will contact you to confirm it’s you, then reset two-step verification. You’ll get an email when you can sign in again.`}
      />

      <ReferenceRow value="MFA-RESET-0192" />

      <Banner tone="warning" title="Only answer calls you expect">
        Your IT admin will never ask for your password or backup codes. If someone does, hang up and
        report it.
      </Banner>

      <ButtonLink href="/sign-in" variant="secondary" fullWidth>
        Back to sign in
      </ButtonLink>
    </AuthPage>
  );
}
