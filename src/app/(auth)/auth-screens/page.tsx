"use client";

import { AuthHeading } from "@/components/auth/AuthPage";
import { useSignIn } from "@/components/auth/SignInContext";
import {
  acceptInvite,
  ApiError,
  checkPassword,
  confirmEnrolment,
  identify,
  startEnrolment,
  verifyMfa,
} from "@/lib/auth/api";
import { completeSignIn } from "@/lib/auth/session";
import { notFound, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * How each screen is reached for QA, using the API (Postman mock demo inputs,
 * see src/lib/api/mock-scenarios.ts) the same way a person would get there.
 */
type Setup =
  | "password-flow" // identify → flow_id
  | "sso-flow" // identify with an SSO domain
  | "signed-in" // full sign-in: session cookies set
  | "deactivated" // identify → 403
  | "expired-password" // password “expired” → 403 reset_token
  | "remembered" // E3 needs the last account
  | "invite-flow" // accept invite → flow_id
  | "invite-done"; // accept + enrol + confirm → signed in, recovery codes

type Screen = { code: string; name: string; href: string; setup?: Setup; how?: string };

const PASSWORD_EMAIL = "ama.mensah@kasamobile.com.gh";
const SSO_EMAIL = "ama.mensah@voltatelecom.com.gh";
const INVITE = "inv_demo";

const SECTIONS: Array<{ title: string; screens: Screen[] }> = [
  {
    title: "A · Sign in",
    screens: [
      { code: "A1", name: "Sign in · enter email", href: "/sign-in" },
      { code: "A2", name: "Checking organisation", href: "/sign-in", how: "Submit any email" },
      { code: "A3", name: "Unknown email domain", href: "/sign-in", how: "Use ama.mensah@gmail.com" },
      { code: "A4", name: "Password", href: "/sign-in/password", setup: "password-flow" },
      { code: "A5", name: "Wrong password", href: "/sign-in/password", setup: "password-flow", how: "Enter “wrong”" },
      { code: "A6", name: "Account locked", href: "/sign-in/password", setup: "password-flow", how: "Enter “locked”" },
      { code: "A7", name: "Account deactivated", href: "/sign-in/deactivated", setup: "deactivated" },
      { code: "A8", name: "Authenticator code", href: "/sign-in/verify", setup: "password-flow" },
      { code: "A9", name: "Code didn’t work", href: "/sign-in/verify", setup: "password-flow", how: "Enter 000000" },
      { code: "A10", name: "Backup code", href: "/sign-in/backup-code", setup: "password-flow" },
      { code: "A11", name: "No connection", href: "/sign-in", how: "Go offline in DevTools, then submit" },
    ],
  },
  {
    title: "B · Company sign-in (SSO)",
    screens: [
      { code: "B1", name: "SSO detected", href: "/sign-in/sso", setup: "sso-flow" },
      { code: "B2", name: "Redirecting", href: "/sign-in/sso/redirecting", setup: "sso-flow" },
      { code: "B3", name: "SSO error", href: "/sign-in/sso/error", how: "Or sign in as noaccess.ama@voltatelecom.com.gh" },
      { code: "B4", name: "Signed in, but no account here", href: "/sign-in/sso/no-account", setup: "sso-flow", how: "No endpoint yet" },
      { code: "B5", name: "Access requested", href: "/sign-in/sso/requested", setup: "sso-flow", how: "No endpoint yet" },
    ],
  },
  {
    title: "C · First sign-in from an invite",
    screens: [
      { code: "C1", name: "Invite email", href: "/emails/invite" },
      { code: "C2", name: "Create password", href: `/invite/${INVITE}` },
      { code: "C3", name: "Password problems", href: `/invite/${INVITE}`, how: "Use a password with “akosua” in it, then Continue" },
      { code: "C4", name: "Set up authenticator", href: `/invite/${INVITE}/authenticator`, setup: "invite-flow" },
      { code: "C5", name: "Save backup codes", href: `/invite/${INVITE}/backup-codes`, setup: "invite-done" },
      { code: "C6", name: "You’re all set", href: `/invite/${INVITE}/done`, setup: "invite-done" },
      { code: "C7", name: "Invite expired", href: "/invite/expired" },
    ],
  },
  {
    title: "D · Recovery",
    screens: [
      { code: "D1", name: "Forgot password", href: "/forgot-password" },
      { code: "D2", name: "Check your email", href: "/forgot-password", how: "Send a reset link" },
      { code: "D3", name: "Choose a new password", href: "/reset-password?token=rst_ok_01" },
      { code: "D4", name: "Reset link expired", href: "/reset-password?token=expired", how: "Submit a valid password" },
      { code: "D5", name: "Password updated", href: "/reset-password/done" },
      { code: "D6", name: "Can’t use authenticator", href: "/sign-in/cant-use-authenticator", setup: "password-flow" },
      { code: "D7", name: "Reset requested from IT admin", href: "/sign-in/reset-requested", setup: "password-flow", how: "No endpoint yet" },
    ],
  },
  {
    title: "E · Sessions & security policy",
    screens: [
      { code: "E1", name: "Password expired", href: "/password-expired", setup: "expired-password" },
      { code: "E2", name: "Idle timeout warning", href: "/queue?idle=75", setup: "signed-in", how: "Stay idle 15 s" },
      { code: "E3", name: "Signed out after inactivity", href: "/signed-out/inactive?case=FD-3050&draft=1", setup: "remembered" },
      { code: "E4", name: "Welcome back · last sign-in", href: "/queue", setup: "signed-in" },
      { code: "E5", name: "New sign-in email", href: "/emails/new-sign-in" },
      { code: "E6", name: "Signed out", href: "/signed-out" },
    ],
  },
  {
    title: "F · Staff console (Super Admin) · no endpoints yet",
    screens: [
      { code: "F1", name: "Staff sign-in", href: "/staff/sign-in" },
      { code: "F2", name: "Staff second factor", href: "/staff/verify" },
      { code: "F3", name: "Choose a workspace", href: "/staff/workspaces" },
      { code: "F4", name: "Request support access", href: "/staff/request-access" },
    ],
  },
];

/** Dev-only QA index: every 01 · Authentication frame, opened with real API state. */
export default function AuthScreensIndex() {
  const router = useRouter();
  const { update, restart } = useSignIn();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (process.env.NODE_ENV === "production") notFound();

  const prepare = async (setup: Setup) => {
    switch (setup) {
      case "password-flow":
      case "sso-flow": {
        const who = await identify(setup === "sso-flow" ? SSO_EMAIL : PASSWORD_EMAIL);
        update({
          email: who.email,
          flowId: who.flow_id,
          operator: who.operator,
          method: who.next,
          redirectUrl: who.sso?.redirect_url ?? null,
        });
        return;
      }
      case "signed-in": {
        const who = await identify(PASSWORD_EMAIL);
        const pw = await checkPassword(who.flow_id, "demo-password");
        const session = await verifyMfa(pw.flow_id, "123456");
        completeSignIn(session.user.email, session.operator?.name);
        return;
      }
      case "deactivated":
        try {
          await identify(`deactivated.${PASSWORD_EMAIL}`);
        } catch (err) {
          if (err instanceof ApiError) update({ adminContact: String(err.problem.admin_contact ?? "") });
        }
        return;
      case "expired-password": {
        const who = await identify(PASSWORD_EMAIL);
        update({ email: who.email, flowId: who.flow_id, operator: who.operator });
        try {
          await checkPassword(who.flow_id, "expired");
        } catch (err) {
          if (err instanceof ApiError) update({ resetToken: String(err.problem.reset_token ?? "") });
        }
        return;
      }
      case "remembered":
        completeSignIn(PASSWORD_EMAIL);
        return;
      case "invite-flow":
      case "invite-done": {
        const accepted = await acceptInvite(INVITE, "Akosua Frimpong", "a-long-new-passphrase");
        update({ email: "akosua.frimpong@kasamobile.com.gh", flowId: accepted.flow_id });
        if (setup === "invite-flow") return;
        await startEnrolment(accepted.flow_id);
        const session = await confirmEnrolment(accepted.flow_id, "123456");
        completeSignIn(session.user.email, session.operator?.name);
        update({ user: session.user, operator: session.operator, recoveryCodes: session.recovery_codes ?? [] });
        return;
      }
    }
  };

  const open = async (screen: Screen) => {
    setBusy(screen.code);
    setError(null);
    restart();
    try {
      if (screen.setup) await prepare(screen.setup);
      router.push(screen.href);
    } catch (err) {
      setError(`${screen.code}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-8 px-6 py-12">
      <AuthHeading
        title="Authentication screens"
        description="Every frame on 01 · Authentication. Opening a screen sets up its state through the API (Postman mock demo inputs). Dev only."
      />
      {error && <p className="text-body-s text-critical-fg">{error}</p>}
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-overline text-text-tertiary uppercase">{section.title}</h2>
          <ul className="flex flex-col rounded-xl border border-border-subtle">
            {section.screens.map((s) => (
              <li key={s.code} className="border-b border-border-subtle last:border-b-0">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => open(s)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-raised disabled:opacity-60"
                >
                  <span className="w-10 font-mono text-mono-s text-text-tertiary">{s.code}</span>
                  <span className="flex-1 text-label-m text-text-primary">{s.name}</span>
                  {s.how && <span className="text-caption text-text-secondary">{s.how}</span>}
                  {busy === s.code && <span className="text-caption text-text-tertiary">…</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
