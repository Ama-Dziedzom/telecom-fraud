import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { Spinner } from "@/components/ui/Button";
import type { ReactNode } from "react";

/** B2 layout: spinner tile + heading while SSO is in progress. */
export function SsoProgress({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <AuthPage>
      <span
        aria-hidden
        className="flex size-[52px] items-center justify-center rounded-[14px] bg-brand-primary-subtle"
      >
        <Spinner tone="brand" />
      </span>
      <div aria-live="polite" aria-busy>
        <AuthHeading title={title} description="This usually takes a couple of seconds." />
      </div>
      {children}
    </AuthPage>
  );
}
