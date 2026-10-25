import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

const tones = {
  info: {
    box: "bg-info-bg border-info-border",
    title: "text-info-fg",
    icon: "icon-info-info-20",
  },
  warning: {
    box: "bg-medium-bg border-medium-border",
    title: "text-medium-fg",
    icon: "icon-alert-triangle-medium",
  },
  error: {
    box: "bg-critical-bg border-critical-border",
    title: "text-critical-fg",
    icon: "icon-alert-circle-critical-20",
  },
  success: {
    box: "bg-success-bg border-success-border",
    title: "text-success-fg",
    icon: "app/icon-check-circle-success-20",
  },
} as const;

/** Banner — inline, persistent message for a page or modal. */
export function Banner({
  tone,
  title,
  children,
  action,
  icon,
}: {
  tone: keyof typeof tones;
  title: ReactNode;
  children?: ReactNode;
  /** Optional button on the right, e.g. “Open FD-3050”. */
  action?: ReactNode;
  icon?: string;
}) {
  const t = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex w-full gap-3 rounded-[10px] border px-3.5 py-3", action ? "items-center" : "items-start", t.box)}
    >
      <Icon name={icon ?? t.icon} size={20} className={action ? "self-start" : undefined} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("text-label-m", t.title)}>{title}</p>
        {children && <p className="text-body-s text-text-primary">{children}</p>}
      </div>
      {action}
    </div>
  );
}

const noteTones = {
  neutral: { box: "bg-surface-sunken text-text-secondary", icon: "icon-info-secondary-16", size: 16 },
  success: { box: "bg-success-bg text-success-fg", icon: "icon-check-circle-success-16", size: 16 },
  info: { box: "bg-info-bg text-info-fg", icon: "icon-shield-info", size: 18 },
  lock: { box: "bg-surface-sunken text-text-secondary", icon: "icon-lock-secondary-16", size: 16 },
} as const;

/** Borderless tinted note with a small icon (e.g. “Why not SMS codes?”). */
export function Note({ tone, children }: { tone: keyof typeof noteTones; children: ReactNode }) {
  const t = noteTones[tone];
  return (
    <div className={cn("flex w-full items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-body-s", t.box)}>
      <Icon name={t.icon} size={t.size} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
