"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { useSignIn } from "@/components/auth/SignInContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * E1 · Password expired — 403 password_expired gives a reset_token for
 * /auth/password/reset. The design’s “Current password” field is left out:
 * the person just entered it and the endpoint doesn’t take it.
 */
export default function PasswordExpiredPage() {
  const router = useRouter();
  const { resetToken, operator, restart } = useSignIn();

  useEffect(() => {
    if (!resetToken) router.replace("/sign-in");
  }, [resetToken, router]);

  if (!resetToken) return null;

  return (
    <AuthPage gap={24}>
      <AuthHeading
        icon={{ name: "icon-key-medium-24", tone: "medium" }}
        title="Time for a new password"
        description={`${operator?.name ?? "Your organisation"} asks everyone to change their password every 90 days. Yours expired today.`}
      />
      <NewPasswordForm
        token={resetToken}
        submitLabel="Update and continue"
        // The API ends the sign-in after a reset (next: sign_in), so D5 asks them to sign in again.
        onDone={() => router.push("/reset-password/done")}
        onExpired={() => {
          restart({ title: "This sign-in timed out", detail: "Start again with your email." });
          router.replace("/sign-in");
        }}
      />
    </AuthPage>
  );
}
