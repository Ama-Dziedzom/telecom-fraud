"use client";

import { AuthHeading, AuthPage, StepOverline } from "@/components/auth/AuthPage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { useCopy } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { useState } from "react";

/** C5 · Save backup codes — the recovery_codes from /auth/mfa/enroll/confirm, shown once. */
export function BackupCodesStep({
  codes,
  overline,
  onFinish,
}: {
  codes: string[];
  overline?: string;
  onFinish: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const text = codes.map((c, i) => `${String(i + 1).padStart(2, "0")}  ${c}`).join("\n");
  const { copied, copy } = useCopy(text);

  const download = () => {
    const blob = new Blob([`FraudDetection backup codes\nEach code works once.\n\n${text}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "frauddetection-backup-codes.txt",
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AuthPage width={440} gap={24}>
      <AuthHeading
        above={overline && <StepOverline>{overline}</StepOverline>}
        title="Save your backup codes"
        description="If you lose your phone, each code lets you sign in once. Keep them somewhere safe. A password manager or printed in a locked drawer."
      />

      <div className="flex flex-col gap-3">
        <ol className="grid grid-cols-2 gap-y-2.5 rounded-xl border border-border-default bg-surface-raised px-5 py-[18px] font-mono print:border-0">
          {codes.map((code, i) => (
            <li key={code} className="flex items-center gap-2.5">
              <span className="text-mono-s text-text-tertiary">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-mono-m text-text-primary">{code}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={download} iconLeft={<Icon name="icon-download" size={16} />}>
            Download .txt
          </Button>
          <Button variant="secondary" size="sm" onClick={copy} iconLeft={<Icon name="icon-copy" size={16} />}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            iconLeft={<Icon name="icon-printer" size={16} />}
          >
            Print
          </Button>
        </div>
      </div>

      <Checkbox
        label="I’ve saved these codes somewhere safe"
        checked={saved}
        onChange={(e) => setSaved(e.target.checked)}
      />

      <Button fullWidth disabled={!saved} onClick={onFinish}>
        Finish setup
      </Button>
    </AuthPage>
  );
}
