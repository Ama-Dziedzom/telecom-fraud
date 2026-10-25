"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { useSignIn } from "@/components/auth/SignInContext";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/Button";
import { ReferenceRow } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * B3 · SSO error (403 sso_not_assigned from /auth/sso/complete).
 * Reached after the IdP redirect, so sign-in state may be gone.
 */
function SsoErrorContent() {
  const { operator, redirectUrl } = useSignIn();
  const reference = useSearchParams().get("ref");
  const company = operator ? `${operator.name}’s` : "Your company’s";

  return (
    <AuthPage back={{ href: "/sign-in" }}>
      <AuthHeading
        icon={{ name: "icon-alert-triangle-critical-24", tone: "critical" }}
        title="Company sign-in didn’t finish"
        description={`${company} sign-in page sent back an error, so we couldn’t sign you in.`}
      />

      <Banner tone="error" title="You’re not assigned to FraudDetection">
        Your company account works, but it hasn’t been given access to this app. Your IT admin can
        add you in a minute.
      </Banner>

      {reference && <ReferenceRow value={reference} />}

      <div className="flex flex-col gap-3">
        <ButtonLink
          href={redirectUrl ? "/sign-in/sso/redirecting" : "/sign-in"}
          fullWidth
          iconLeft={<Icon name="icon-refresh-white" size={20} />}
        >
          Try again
        </ButtonLink>
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          Use a different email
        </ButtonLink>
      </div>
    </AuthPage>
  );
}

export default function SsoErrorPage() {
  return (
    <Suspense>
      <SsoErrorContent />
    </Suspense>
  );
}
