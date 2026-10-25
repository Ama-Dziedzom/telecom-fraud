"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useSignIn } from "@/components/auth/SignInContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useRemaining } from "@/components/ui/Countdown";
import { forgotPassword } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const RESEND_COOLDOWN_MS = 60_000;

/** D2 · Check your email */
export default function CheckEmailPage() {
  const router = useRouter();
  const { email } = useSignIn();
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_COOLDOWN_MS);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const remaining = useRemaining(resendAt);

  useEffect(() => {
    if (!email) router.replace("/forgot-password");
  }, [email, router]);

  const resend = async () => {
    setSending(true);
    setFailure(null);
    try {
      await forgotPassword(email);
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
    } catch (err) {
      setFailure(err);
    } finally {
      setSending(false);
    }
  };

  if (!email) return null;

  const seconds = Math.ceil(remaining / 1000);
  const cooldown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-mail-check-success", tone: "success" }}
        title="Check your email"
        description={`If an account exists for ${email}, a reset link is on its way. It works for 30 minutes.`}
      />

      <RequestError error={failure} />

      <div className="flex flex-col gap-3">
        <Button
          variant="secondary"
          fullWidth
          disabled={remaining > 0}
          loading={sending}
          onClick={resend}
        >
          {remaining > 0 ? `Resend link · ${cooldown}` : "Resend link"}
        </Button>
        <ButtonLink href="/sign-in" variant="ghost" fullWidth>
          Back to sign in
        </ButtonLink>
      </div>

      <p className="text-body-s text-text-secondary">
        Nothing after 5 minutes? Check spam, or ask your IT admin to confirm your email address.
      </p>
    </AuthPage>
  );
}
