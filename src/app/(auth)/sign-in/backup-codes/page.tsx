"use client";

import { BackupCodesStep } from "@/components/auth/BackupCodesStep";
import { useSignIn } from "@/components/auth/SignInContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** C5 for existing users, after setting up the authenticator at sign-in. */
export default function SignInBackupCodesPage() {
  const router = useRouter();
  const { recoveryCodes } = useSignIn();

  // Codes are shown once; without them (e.g. after a refresh) carry on into the app.
  useEffect(() => {
    if (recoveryCodes.length === 0) router.replace("/queue");
  }, [recoveryCodes.length, router]);

  if (recoveryCodes.length === 0) return null;
  return <BackupCodesStep codes={recoveryCodes} onFinish={() => router.push("/queue")} />;
}
