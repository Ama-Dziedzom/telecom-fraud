"use client";

import { AuthenticatorSetup } from "@/components/auth/AuthenticatorSetup";
import { useSignIn } from "@/components/auth/SignInContext";
import { completeSignIn } from "@/lib/auth/session";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** C4 · Set up authenticator (invite flow, after accepting the invite) */
export default function InviteSetUpAuthenticatorPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { flowId, update } = useSignIn();

  // The flow_id comes from accepting the invite; without it, start at C2.
  useEffect(() => {
    if (!flowId) router.replace(`/invite/${token}`);
  }, [flowId, router, token]);

  if (!flowId) return null;

  return (
    <AuthenticatorSetup
      flowId={flowId}
      overline="Step 2 of 3 · Two-step verification"
      onConfirmed={(session) => {
        completeSignIn(session.user.email);
        update({ user: session.user, operator: session.operator, recoveryCodes: session.recovery_codes ?? [] });
        router.push(`/invite/${token}/backup-codes`);
      }}
    />
  );
}
