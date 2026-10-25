"use client";

import { AuthHeading, AuthPage, IconLink } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useMfaVerify } from "@/components/auth/useMfaVerify";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useState, type FormEvent } from "react";

/** A10 · Backup code — /auth/mfa/verify accepts recovery codes too. */
export default function BackupCodePage() {
  const [code, setCode] = useState("");
  // Wording for a rejected backup code isn’t in the design yet.
  const { flow, verify, submitting, error, clearError, blocked, failure } = useMfaVerify(
    "That backup code didn’t work. Check it and try again.",
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void verify(code.trim());
  };

  if (!flow.ready) return null;

  return (
    <AuthPage back={{ href: "/sign-in/verify" }}>
      <AuthHeading
        icon={{ name: "icon-key-brand-24", tone: "brand" }}
        title="Use a backup code"
        description="Enter one of the codes you saved when you set up two-step verification."
      />

      <RequestError error={failure} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Backup code"
          name="backup-code"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          required
          autoFocus
          mono
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            clearError();
          }}
          // The API doesn’t say how many codes are left, so the count from the design is omitted.
          hint="Each code works once."
          error={error}
        />
        <Button type="submit" fullWidth disabled={blocked} loading={submitting}>
          Verify
        </Button>
      </form>

      <IconLink href="/sign-in/verify" icon="icon-arrow-left-brand">
        Use my authenticator app instead
      </IconLink>
    </AuthPage>
  );
}
