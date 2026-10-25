"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { useRequireFlow } from "@/components/auth/SignInContext";
import { ButtonLink } from "@/components/ui/Button";

/** B5 · Access requested */
export default function SsoAccessRequestedPage() {
  const { email, ready } = useRequireFlow();
  if (!ready) return null;

  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-check-circle-success", tone: "success" }}
        title="Request sent"
        description={`Your IT admin has your request. You’ll get an email at ${email} as soon as you’re added. Usually the same working day.`}
      />
      <ButtonLink href="/sign-in" variant="secondary" fullWidth>
        Back to sign in
      </ButtonLink>
    </AuthPage>
  );
}
