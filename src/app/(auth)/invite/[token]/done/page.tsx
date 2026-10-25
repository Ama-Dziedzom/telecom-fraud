"use client";

import { AuthHeading, AuthPage, IconLink } from "@/components/auth/AuthPage";
import { useSignIn } from "@/components/auth/SignInContext";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getMe, roleLabel, type User } from "@/lib/auth/api";
import { useEffect, useState } from "react";

/** What each role can do; only Fraud Analyst is designed so far. */
const ABILITIES: Record<string, Array<{ icon: string; label: string }>> = {
  fraud_analyst: [
    { icon: "icon-inbox-brand", label: "Triage live alerts as they come in" },
    { icon: "icon-folder-brand", label: "Investigate and resolve fraud cases" },
    { icon: "icon-ban-brand", label: "Freeze wallets and suspend SIMs to stop losses" },
  ],
};

/** C6 · You’re all set — the person is signed in after confirming the authenticator. */
export default function InviteDonePage() {
  const { user: flowUser, operator } = useSignIn();
  const [user, setUser] = useState<User | null>(flowUser);

  // After a refresh the flow is gone but the session cookie isn’t: ask /me.
  useEffect(() => {
    if (!flowUser) getMe().then(setUser).catch(() => setUser(null));
  }, [flowUser]);

  if (!user) return null;
  const abilities = ABILITIES[user.role] ?? [];

  return (
    <AuthPage securityNote={false}>
      <AuthHeading
        icon={{ name: "icon-check-circle-success", tone: "success" }}
        title={`You’re all set, ${user.name.split(" ")[0]}`}
        description={`You’re signed in as a ${roleLabel(user.role)}${operator ? ` at ${operator.name}` : ""}.`}
      />

      {abilities.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-overline text-text-tertiary uppercase">What you can do</h2>
          <ul className="flex flex-col rounded-xl border border-border-default">
            {abilities.map((a) => (
              <li
                key={a.label}
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3.5 last:border-b-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-primary-subtle">
                  <Icon name={a.icon} size={16} />
                </span>
                <span className="text-body-m text-text-primary">{a.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ButtonLink href="/queue" fullWidth iconRight={<Icon name="icon-arrow-right" size={20} />}>
        Go to my queue
      </ButtonLink>

      <IconLink href="#tour" icon="icon-activity-brand">
        Take a 2-minute tour
      </IconLink>
    </AuthPage>
  );
}
