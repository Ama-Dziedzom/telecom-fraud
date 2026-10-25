"use client";

import { AuthHeading, AuthPage, StepOverline } from "@/components/auth/AuthPage";
import { RequestError } from "@/components/auth/RequestError";
import { useFlowExpired } from "@/components/auth/SignInContext";
import { Note } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CopyLink } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { OtpInput } from "@/components/ui/OtpInput";
import { ApiError, confirmEnrolment, startEnrolment, type Session } from "@/lib/auth/api";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

function Step({
  marker,
  title,
  description,
  children,
}: {
  marker: "done" | number;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5">
      {marker === "done" ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-bg">
          <Icon name="icon-check-success-14" size={14} />
          <span className="sr-only">Done:</span>
        </span>
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-primary-subtle text-label-s text-text-brand">
          {marker}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-label-m text-text-primary">{title}</p>
          {description && <p className="text-body-s text-text-secondary">{description}</p>}
        </div>
        {children}
      </div>
    </li>
  );
}

/** Groups a base32 secret in fours for reading aloud: JBSW Y3DP EHPK 3PXP */
const groupSecret = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

/**
 * C4 · Set up authenticator — POST /auth/mfa/enroll for the QR code, then
 * /auth/mfa/enroll/confirm with the first code (signs the person in and
 * returns the recovery codes).
 */
export function AuthenticatorSetup({
  flowId,
  overline,
  onConfirmed,
}: {
  flowId: string;
  overline?: string;
  onConfirmed: (session: Session) => void;
}) {
  const flowExpired = useFlowExpired();
  const [enrolment, setEnrolment] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  useResetOnHide(() => setSubmitting(false));

  useEffect(() => {
    let cancelled = false;
    startEnrolment(flowId)
      .then(async ({ secret, otpauth_url }) => {
        const qr = await QRCode.toString(otpauth_url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
        if (!cancelled) setEnrolment({ secret, qr });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "flow_expired") flowExpired(err.problem);
        else setFailure(err);
      });
    return () => {
      cancelled = true;
    };
  }, [flowId, flowExpired]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFailure(null);
    try {
      onConfirmed(await confirmEnrolment(flowId, code));
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.code === "invalid_code") {
        setCodeError(
          "That code didn’t work. Codes change every 30 seconds. Enter the newest one. If it keeps failing, make sure your phone’s time is set automatically.",
        );
        setFailures((n) => n + 1);
      } else if (err instanceof ApiError && err.code === "flow_expired") {
        flowExpired(err.problem);
      } else {
        setFailure(err);
      }
    }
  };

  return (
    <AuthPage width={480} gap={24} securityNote={false}>
      <AuthHeading
        above={overline && <StepOverline>{overline}</StepOverline>}
        title="Set up two-step verification"
        description="Each time you sign in, you’ll also enter a code from an app on your phone."
      />

      <RequestError error={failure} />

      <form id="setup-authenticator" onSubmit={handleSubmit}>
        <ol className="flex flex-col gap-5">
          <Step
            marker="done"
            title="Install an authenticator app"
            description="Microsoft Authenticator, Google Authenticator or Authy, all free."
          />
          <Step marker={2} title="Scan this QR code with the app">
            <div className="flex w-full items-center gap-4 rounded-xl border border-border-default p-3">
              <div className="size-[120px] shrink-0">
                {enrolment && (
                  // eslint-disable-next-line @next/next/no-img-element -- generated data URI
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(enrolment.qr)}`}
                    alt="QR code for your authenticator app"
                    width={120}
                    height={120}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-body-s text-text-secondary">Can’t scan? Enter this key:</p>
                <p className="font-mono text-mono-m text-text-primary">
                  {enrolment ? groupSecret(enrolment.secret) : "…"}
                </p>
                {enrolment && <CopyLink value={enrolment.secret}>Copy key</CopyLink>}
              </div>
            </div>
          </Step>
          <Step marker={3} title="Enter the 6-digit code it shows">
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setCodeError(null);
              }}
              error={Boolean(codeError)}
              errorKey={failures}
              aria-label="Code from your authenticator app"
            />
            {codeError && (
              <p role="alert" className="flex items-start gap-2 text-body-s text-critical-fg">
                <Icon name="icon-alert-circle-critical" size={16} className="mt-0.5 shrink-0" />
                {codeError}
              </p>
            )}
          </Step>
        </ol>
      </form>

      <Button
        type="submit"
        form="setup-authenticator"
        fullWidth
        disabled={code.length < 6 || !enrolment}
        loading={submitting}
      >
        Verify and continue
      </Button>

      <Note tone="neutral">
        Why not SMS codes? SIM-swap fraud can redirect text messages to a criminal’s phone. Exactly
        what FraudDetection catches. An app on your phone can’t be swapped away.
      </Note>
    </AuthPage>
  );
}
