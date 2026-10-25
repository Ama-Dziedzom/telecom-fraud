"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { useRequireFlow } from "@/components/auth/SignInContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { requestAuthenticatorReset } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/** D6 · Can’t use authenticator. TODO: the IT-admin reset request has no endpoint yet (local). */
export default function CantUseAuthenticatorPage() {
  const router = useRouter();
  const { email, ready } = useRequireFlow();
  const [choice, setChoice] = useState<"backup" | "admin">("backup");
  const [submitting, setSubmitting] = useState(false);
  useResetOnHide(() => setSubmitting(false));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (choice === "backup") {
      router.push("/sign-in/backup-code");
      return;
    }
    setSubmitting(true);
    await requestAuthenticatorReset(email);
    router.push("/sign-in/reset-requested");
  };

  if (!ready) return null;
  const admin = "Your IT admin";

  return (
    <AuthPage back={{ href: "/sign-in/verify" }}>
      <AuthHeading
        icon={{ name: "icon-phone-secondary", tone: "neutral" }}
        title="Can’t use your authenticator?"
        description="Lost or changed your phone? Choose how you want to get back in."
      />

      <form id="recovery-choice" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">How do you want to get back in?</legend>
          <OptionCard
            name="recovery"
            value="backup"
            checked={choice === "backup"}
            onChange={() => setChoice("backup")}
            title="Use a backup code"
            badge={<Badge label="Instant" tone="success" />}
            description="Use one of the 10 codes you saved during set-up. Fastest, works right now."
          />
          <OptionCard
            name="recovery"
            value="admin"
            checked={choice === "admin"}
            onChange={() => setChoice("admin")}
            title="Ask my IT admin to reset it"
            badge={<Badge label="~1 working day" tone="neutral" />}
            description={`${admin} will confirm it’s you by phone or in person, then reset two-step verification. Usually within one working day.`}
          />
        </fieldset>
      </form>

      <Button
        type="submit"
        form="recovery-choice"
        fullWidth
        loading={submitting}
        iconRight={<Icon name="icon-arrow-right" size={20} />}
      >
        Continue
      </Button>
    </AuthPage>
  );
}
