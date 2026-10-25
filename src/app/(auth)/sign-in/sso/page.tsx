"use client";

import { AccountChip, AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { useRequireFlow } from "@/components/auth/SignInContext";
import { OperatorLogo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** B1 · SSO detected (/auth/identify answered next = "sso") */
export default function SsoDetectedPage() {
  const { email, operator, ready } = useRequireFlow();
  if (!ready || !operator) return null;

  return (
    <AuthPage back={{ href: "/sign-in" }}>
      <AuthHeading
        above={<OperatorLogo operator={operator.name} />}
        title={`Continue with ${operator.name}`}
        description={`${operator.name} uses single sign-on. You’ll confirm on your company’s sign-in page, then come straight back here.`}
      />

      <AccountChip email={email} changeHref="/sign-in" />

      <ButtonLink
        href="/sign-in/sso/redirecting"
        fullWidth
        iconRight={<Icon name="icon-external-white" size={20} />}
      >
        Continue to company sign-in
      </ButtonLink>

      <p className="text-body-s text-text-secondary">
        Your company password and two-step verification are managed by {operator.name}, not
        FraudDetection.
      </p>
    </AuthPage>
  );
}
