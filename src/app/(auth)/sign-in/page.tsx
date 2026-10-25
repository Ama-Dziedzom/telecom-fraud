"use client";

import { AuthHeading, AuthPage, PromptRow } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useSignIn } from "@/components/auth/SignInContext";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { identify, isProblem, OfflineError } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { preload } from "react-dom";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

type Status =
  | { kind: "idle" }
  | { kind: "checking" } // A2
  | { kind: "unknown"; domain: string } // A3
  | { kind: "offline" } // A11
  | { kind: "failed"; error: unknown };

/** A1 · Sign in · enter email (+ A2 checking, A3 unknown domain, A11 no connection) */
export default function SignInPage() {
  const router = useRouter();
  const { email, notice, update } = useSignIn();
  const [value, setValue] = useState(email);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  useResetOnHide(() => setStatus({ kind: "idle" }));

  // The offline banner’s icons are requested only once offline, so fetch them now.
  preload("/figma/auth/icon-alert-triangle-medium.svg", { as: "image" });
  preload("/figma/auth/icon-refresh-white.svg", { as: "image" });

  const submit = useCallback(async () => {
    const trimmed = value.trim();
    setStatus({ kind: "checking" });
    update({ notice: null });
    try {
      const result = await identify(trimmed);
      update({
        email: result.email,
        flowId: result.flow_id,
        operator: result.operator,
        method: result.next,
        redirectUrl: result.redirect_url ?? null,
      });
      router.push(result.next === "sso" ? "/sign-in/sso" : "/sign-in/password");
    } catch (err) {
      if (err instanceof OfflineError) return setStatus({ kind: "offline" });
      if (isProblem(err, "domain_not_recognised")) {
        return setStatus({ kind: "unknown", domain: trimmed.split("@")[1] ?? trimmed });
      }
      if (isProblem(err, "account_deactivated")) {
        update({ email: trimmed, adminContact: String(err.problem.admin_contact ?? "") || null });
        return router.push("/sign-in/deactivated");
      }
      setStatus({ kind: "failed", error: err });
    }
  }, [value, router, update]);

  // A11: “We’ll try again as soon as you’re back online.”
  useEffect(() => {
    if (status.kind !== "offline") return;
    const retry = () => void submit();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [status.kind, submit]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  const checking = status.kind === "checking";

  return (
    <AuthPage>
      <AuthHeading
        title="Sign in"
        description="Use your work email. We’ll take you to the right sign-in for your organisation."
      />

      {notice && status.kind === "idle" && (
        <Banner tone="warning" title={notice.title}>
          {notice.detail}
        </Banner>
      )}

      {status.kind === "offline" && (
        <Banner tone="warning" title="You’re offline">
          Check your network or VPN. We’ll try again as soon as you’re back online. What you typed
          is kept.
        </Banner>
      )}

      {status.kind === "failed" && <RequestError error={status.error} />}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Work email"
          type="email"
          name="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="name@yourcompany.com"
          value={value}
          disabled={checking}
          onChange={(e) => {
            setValue(e.target.value);
            if (status.kind === "unknown") setStatus({ kind: "idle" });
          }}
          error={
            status.kind === "unknown" &&
            `We don’t recognise ${status.domain}. Use the email your organisation gave you, or ask your IT admin if your company uses FraudDetection.`
          }
          iconLeft={<Icon name={checking ? "icon-mail-disabled" : "icon-mail"} size={18} />}
        />
        <Button
          type="submit"
          fullWidth
          loading={checking}
          loadingLabel="Checking your organisation…"
          iconLeft={
            status.kind === "offline" ? <Icon name="icon-refresh-white" size={20} /> : undefined
          }
          iconRight={
            status.kind === "offline" ? undefined : <Icon name="icon-arrow-right" size={20} />
          }
        >
          {status.kind === "offline" ? "Try again" : "Continue"}
        </Button>
      </form>

      {(status.kind === "idle" || status.kind === "checking") && (
        <PromptRow prompt="New to FraudDetection?">
          <span className="text-text-primary">Your IT admin will send you an invite.</span>
        </PromptRow>
      )}
    </AuthPage>
  );
}
