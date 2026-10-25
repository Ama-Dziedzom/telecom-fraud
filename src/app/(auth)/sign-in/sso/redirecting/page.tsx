"use client";

import { AuthPage, PromptRow } from "@/components/auth/AuthPage";
import { useRequireFlow } from "@/components/auth/SignInContext";
import { Banner } from "@/components/ui/Banner";
import { SsoProgress } from "@/components/auth/SsoProgress";
import { useEffect } from "react";

/** B2 · Redirecting — hands over to the company’s identity provider. */
export default function SsoRedirectingPage() {
  const { operator, redirectUrl, ready } = useRequireFlow();

  useEffect(() => {
    if (ready && redirectUrl) window.location.assign(redirectUrl);
  }, [ready, redirectUrl]);

  if (!ready || !operator) return null;

  if (!redirectUrl) {
    return (
      <AuthPage back={{ href: "/sign-in" }}>
        <Banner tone="error" title="We couldn’t find your company’s sign-in page">
          Go back and try again. If it keeps happening, contact your IT admin.
        </Banner>
      </AuthPage>
    );
  }

  return (
    <SsoProgress title={`Taking you to ${operator.name} sign-in…`}>
      <PromptRow prompt="Nothing happening?">
        <a href={redirectUrl} className="rounded text-label-s text-text-brand hover:underline">
          Open company sign-in
        </a>
      </PromptRow>
    </SsoProgress>
  );
}
