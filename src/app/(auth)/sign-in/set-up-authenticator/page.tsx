"use client";

import { AuthenticatorSetup } from "@/components/auth/AuthenticatorSetup";
import { useRequireFlow } from "@/components/auth/SignInContext";
import { completeSignIn } from "@/lib/auth/session";
import { useRouter } from "next/navigation";

/**
 * C4 for existing users: /auth/password answered next = "mfa_enroll"
 * (first sign-in, or an IT Admin reset their authenticator).
 */
export default function SignInSetUpAuthenticatorPage() {
  const router = useRouter();
  const { flowId, ready, update } = useRequireFlow();
  if (!ready || !flowId) return null;

  return (
    <AuthenticatorSetup
      flowId={flowId}
      onConfirmed={(session) => {
        completeSignIn(session.user.email, session.operator?.name);
        update({ user: session.user, recoveryCodes: session.recovery_codes ?? [] });
        router.push(session.recovery_codes?.length ? "/sign-in/backup-codes" : "/queue");
      }}
    />
  );
}
