"use client";

import { BackupCodesStep } from "@/components/auth/BackupCodesStep";
import { useSignIn } from "@/components/auth/SignInContext";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** C5 · Save backup codes (invite flow) */
export default function InviteBackupCodesPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { recoveryCodes } = useSignIn();

  // Codes are shown once; without them (e.g. after a refresh) move on.
  useEffect(() => {
    if (recoveryCodes.length === 0) router.replace(`/invite/${token}/done`);
  }, [recoveryCodes.length, router, token]);

  if (recoveryCodes.length === 0) return null;
  return (
    <BackupCodesStep
      codes={recoveryCodes}
      overline="Step 3 of 3 · Backup codes"
      onFinish={() => router.push(`/invite/${token}/done`)}
    />
  );
}
