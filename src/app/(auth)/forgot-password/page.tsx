"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useSignIn } from "@/components/auth/SignInContext";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { forgotPassword, isProblem } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { preload } from "react-dom";
import { useState, type FormEvent } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/** D1 · Forgot password — always 202 unless the company uses SSO (409 sso_managed). */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { email, update } = useSignIn();
  const [value, setValue] = useState(email);
  const [submitting, setSubmitting] = useState(false);
  const [ssoManaged, setSsoManaged] = useState<{ title?: string; detail?: string } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useResetOnHide(() => setSubmitting(false));

  // The offline banner’s icon is requested only once offline, so fetch it now.
  preload("/figma/auth/icon-alert-triangle-medium.svg", { as: "image" });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFailure(null);
    setSsoManaged(null);
    try {
      await forgotPassword(value.trim());
      update({ email: value.trim() });
      router.push("/forgot-password/sent");
    } catch (err) {
      setSubmitting(false);
      if (isProblem(err, "sso_managed")) setSsoManaged(err.problem);
      else setFailure(err);
    }
  };

  return (
    <AuthPage back={{ href: "/sign-in", label: "Back to sign in" }}>
      <AuthHeading
        icon={{ name: "icon-key-brand-24", tone: "brand" }}
        title="Reset your password"
        description="Enter your work email and we’ll send you a link to choose a new password. The link works for 30 minutes."
      />

      {ssoManaged && (
        <Banner tone="info" title={ssoManaged.title ?? "Your company manages your password"}>
          {ssoManaged.detail}
        </Banner>
      )}
      <RequestError error={failure} />

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
          onChange={(e) => setValue(e.target.value)}
          iconLeft={<Icon name="icon-mail" size={18} />}
        />
        <Button type="submit" fullWidth loading={submitting}>
          Send reset link
        </Button>
      </form>

      <p className="text-body-s text-text-secondary">
        Does your company use single sign-on? Reset your password with them instead. FraudDetection
        doesn’t store it.
      </p>
    </AuthPage>
  );
}
