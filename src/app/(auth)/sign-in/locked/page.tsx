"use client";

import { AuthHeading, AuthPage, PromptRow } from "@/components/auth/AuthPage";
import { useSignIn } from "@/components/auth/SignInContext";
import { ButtonLink } from "@/components/ui/Button";
import { CountdownCard, useRemaining } from "@/components/ui/Countdown";
import { Icon } from "@/components/ui/Icon";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000;

function formatClock(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** A6 · Account locked (423 account_locked → locked_until) */
export default function LockedPage() {
  const router = useRouter();
  const { lockedUntil, restart } = useSignIn();
  // A past or missing locked_until (e.g. the mock’s fixed example) falls back to 15 minutes.
  const [until] = useState(() =>
    lockedUntil && lockedUntil > Date.now() ? lockedUntil : Date.now() + DEFAULT_LOCKOUT_MS,
  );
  const remaining = useRemaining(until);

  useEffect(() => {
    if (remaining > 0) return;
    restart();
    router.replace("/sign-in");
  }, [remaining, router, restart]);

  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-lock-critical", tone: "critical" }}
        title="Account temporarily locked"
        description="Too many incorrect passwords. This protects your account from someone guessing it."
      />

      <CountdownCard label="Try again in" until={until} aside={`Unlocks at ${formatClock(until)}`} />

      <div className="flex flex-col gap-3">
        <ButtonLink
          href="/forgot-password"
          fullWidth
          iconLeft={<Icon name="icon-key-white" size={20} />}
        >
          Reset password instead
        </ButtonLink>
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          Back to sign in
        </ButtonLink>
      </div>

      <PromptRow prompt="Didn’t try to sign in?">
        <a href="#report-to-it-admin" className="rounded text-label-s text-text-brand hover:underline">
          Tell your IT admin now.
        </a>
      </PromptRow>
    </AuthPage>
  );
}
