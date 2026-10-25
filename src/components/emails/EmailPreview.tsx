import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * In-app preview of a transactional email as designed (C1, E5).
 * The production email must be rendered separately with email-safe markup
 * (tables + inline styles); this keeps the design reviewable in the app.
 */
export function EmailPreview({
  label,
  subject,
  from,
  to,
  bodyClassName,
  children,
}: {
  label: string;
  subject: string;
  from: string;
  to: string;
  /** Body padding/gap differ slightly per email in Figma. */
  bodyClassName: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[18px] bg-surface-canvas px-4 py-12">
      <p className="flex items-center gap-2 rounded-full bg-surface-base px-3 py-1.5 text-caption font-medium text-text-secondary">
        <Icon name="icon-mail-secondary-16" size={16} />
        {label}
      </p>
      <article className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-border-default bg-surface-base shadow-md">
        <header className="flex flex-col gap-1.5 border-b border-border-subtle px-7 py-5">
          <h1 className="text-h3 text-text-primary">{subject}</h1>
          <p className="flex flex-wrap items-center gap-1.5 text-body-s">
            <span className="text-label-s text-text-primary">FraudDetection</span>
            <span className="text-text-secondary">&lt;{from}&gt;</span>
            <span className="text-text-tertiary">to {to}</span>
          </p>
        </header>
        <div className={cn("flex flex-col", bodyClassName)}>
          <Logo className="w-fit" />
          {children}
        </div>
      </article>
    </main>
  );
}
