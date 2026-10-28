"use client";

import { useAuthStep } from "@/components/auth/AuthFrame";
import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordContent() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [expired, setExpired] = useState(false);

  if (!token || expired) return <ResetLinkExpired />;

  return (
    <AuthPage gap={24}>
      {/* The API only reveals the account after the reset, so the “For <email>” line is omitted. */}
      <AuthHeading icon={{ name: "icon-lock-brand-24", tone: "brand" }} title="Choose a new password" />
      <NewPasswordForm
        token={token}
        submitLabel="Update password"
        signedOutNotice
        onDone={() => router.push("/reset-password/done")}
        onExpired={() => setExpired(true)}
      />
    </AuthPage>
  );
}

/** D4 · Reset link expired (410 link_expired, or no token) */
function ResetLinkExpired() {
  useAuthStep(1);
  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-clock", tone: "neutral" }}
        title="This link has expired"
        description="Reset links work once and only for 30 minutes. We can send you a fresh one."
      />
      <div className="flex flex-col gap-3">
        <ButtonLink
          href="/forgot-password"
          fullWidth
          iconLeft={<Icon name="icon-send-white" size={20} />}
        >
          Send a new link
        </ButtonLink>
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          Back to sign in
        </ButtonLink>
      </div>
    </AuthPage>
  );
}

/** D3 · Choose a new password (+ D4 when the link is invalid or expired) */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
