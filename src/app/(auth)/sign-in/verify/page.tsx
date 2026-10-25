"use client";

import { AuthHeading, AuthPage, IconLink } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useMfaVerify } from "@/components/auth/useMfaVerify";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OtpInput } from "@/components/ui/OtpInput";
import { useState, type FormEvent } from "react";

const CODE_LENGTH = 6;

/** A8 · Authenticator code (+ A9 code didn’t work) */
export default function VerifyPage() {
  const [code, setCode] = useState("");
  const { flow, verify, submitting, error, clearError, blocked, failures, failure } = useMfaVerify(
    "That code didn’t work. Codes change every 30 seconds. Enter the newest one. If it keeps failing, make sure your phone’s time is set automatically.",
  );

  const complete = code.length === CODE_LENGTH;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (complete) void verify(code);
  };

  if (!flow.ready) return null;

  return (
    <AuthPage back={{ href: "/sign-in/password" }}>
      <AuthHeading
        icon={{ name: "icon-phone", tone: "brand" }}
        title="Enter your 6-digit code"
        description={`Open your authenticator app and enter the code shown for FraudDetection · ${flow.operator?.name ?? "your organisation"}.`}
      />

      <RequestError error={failure} />

      <form onSubmit={handleSubmit} className={error ? "flex flex-col gap-3" : "flex flex-col gap-4"}>
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            clearError();
          }}
          length={CODE_LENGTH}
          error={Boolean(error)}
          errorKey={failures}
          autoFocus
        />
        {error && (
          <p role="alert" className="flex items-start gap-2 text-body-s text-critical-fg">
            <Icon name="icon-alert-circle-critical" size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" fullWidth disabled={!complete || blocked} loading={submitting}>
          Verify
        </Button>
      </form>

      <div className="flex flex-col gap-2.5">
        <IconLink href="/sign-in/backup-code" icon="icon-key">
          Use a backup code instead
        </IconLink>
        <IconLink href="/sign-in/cant-use-authenticator" icon="icon-support">
          I can’t use my authenticator
        </IconLink>
      </div>
    </AuthPage>
  );
}
