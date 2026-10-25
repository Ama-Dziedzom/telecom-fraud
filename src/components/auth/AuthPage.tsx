import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { IconTile, type IconTileTone } from "@/components/ui/IconTile";
import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

const SECURITY_NOTES = {
  default: "Authorised personnel only. Sign-ins are monitored and logged.",
  staff:
    "Staff console. All access is recorded in the platform audit log and visible to operators for their data.",
};

/**
 * Right-hand column of every auth screen: back link + help in the top bar,
 * the form column centred vertically, and the footer.
 */
export function AuthPage({
  back,
  width = 400,
  gap = 32,
  variant = "default",
  securityNote = true,
  children,
}: {
  back?: { href: string; label?: string };
  /** Form column width from Figma: 400 by default, 420/440/480/520 on some screens. */
  width?: number;
  /** Vertical gap between form-column blocks (32 by default, 24/28 on denser screens). */
  gap?: number;
  variant?: "default" | "staff";
  securityNote?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-32px)] flex-col px-6 pt-7 pb-8 sm:px-12">
      <header className="flex items-center justify-between gap-4">
        {back ? (
          <Link
            href={back.href}
            className="flex items-center gap-1.5 rounded text-label-s text-text-secondary hover:text-text-primary"
          >
            <Icon name="icon-arrow-left" size={16} />
            {back.label ?? "Back"}
          </Link>
        ) : (
          <span />
        )}
        {variant === "staff" ? (
          <p className="flex items-center gap-1.5 text-body-s text-text-secondary">
            Staff help:
            <a href="#platform-oncall" className="rounded text-label-s text-text-brand hover:underline">
              #platform-oncall
            </a>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-body-s text-text-secondary">
            Trouble signing in?
            <a
              href="#contact-it-admin"
              className="rounded text-label-s text-text-brand hover:underline"
            >
              Contact your IT admin
            </a>
          </p>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="flex w-full flex-col" style={{ maxWidth: width, gap }}>
          {children}
          {securityNote && (
            <p className="flex items-start gap-2 text-caption text-text-tertiary">
              <Icon name="icon-shield" size={16} />
              {SECURITY_NOTES[variant]}
            </p>
          )}
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-4 text-caption">
        <div className="flex items-center gap-4">
          <span className="text-text-tertiary">© 2026 FraudDetection</span>
          <a href="#privacy" className="text-text-secondary hover:text-text-primary">
            Privacy
          </a>
          <a href="#terms" className="text-text-secondary hover:text-text-primary">
            Terms
          </a>
        </div>
        <p className="flex items-center gap-1.5 text-text-secondary">
          <span className="size-1.5 rounded-full bg-success-fg" />
          All systems operational
        </p>
      </footer>
    </div>
  );
}

export function AuthHeading({
  title,
  description,
  above,
  icon,
}: {
  title: string;
  description?: ReactNode;
  /** Content above the heading (operator logo, step overline). */
  above?: ReactNode;
  icon?: { name: string; tone: IconTileTone };
}) {
  const hasAbove = Boolean(above || icon);
  return (
    <div className={cn("flex flex-col", hasAbove && "gap-5")}>
      {above}
      {icon && <IconTile icon={icon.name} tone={icon.tone} />}
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary">{title}</h1>
        {description && <p className="text-body-l text-text-secondary">{description}</p>}
      </div>
    </div>
  );
}

/** Uppercase brand overline, e.g. “Step 1 of 3 · Password”. */
export function StepOverline({ children }: { children: ReactNode }) {
  return <p className="text-overline text-text-brand uppercase">{children}</p>;
}

function initialsFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Account chip — avatar + email (+ “Change”). */
export function AccountChip({ email, changeHref }: { email: string; changeHref?: string }) {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-full bg-surface-sunken py-2 pr-2 pl-3">
      <Avatar initials={initialsFromEmail(email)} />
      <span className="min-w-0 truncate text-body-m font-medium text-text-primary">{email}</span>
      {changeHref && (
        <Link
          href={changeHref}
          className="ml-auto shrink-0 rounded px-1 text-label-s text-text-brand hover:underline"
        >
          Change
        </Link>
      )}
    </div>
  );
}

export function StaffBadge() {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-ink px-2.5 py-1 text-caption font-medium text-text-inverse">
      <Icon name="icon-shield-white-14" size={14} />
      FraudDetection staff only
    </span>
  );
}

export function DividerWithText({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border-default" />
      <span className="text-caption text-text-tertiary">{children}</span>
      <span className="h-px flex-1 bg-border-default" />
    </div>
  );
}

/** Brand text link with a leading 16px icon. */
export function IconLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1.5 rounded text-label-s text-text-brand hover:underline"
    >
      <Icon name={icon} size={16} />
      {children}
    </Link>
  );
}

/** “Didn’t try to sign in? Tell your IT admin now.” style row. */
export function PromptRow({ prompt, children }: { prompt: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-body-s text-text-secondary">
      {prompt}
      {children}
    </p>
  );
}
