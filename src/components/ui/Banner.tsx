import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

const tones = {
  info: {
    box: "bg-info-bg border-info-border",
    title: "text-info-fg",
    icon: "app/icon-info-info-16",
  },
  warning: {
    box: "bg-medium-bg border-medium-border",
    title: "text-medium-fg",
    icon: "app/icon-alert-triangle-medium-16",
  },
  error: {
    box: "bg-critical-bg border-critical-border",
    title: "text-critical-fg",
    icon: "app/icon-alert-circle-critical-16",
  },
  success: {
    box: "bg-success-bg border-success-border",
    title: "text-success-fg",
    icon: "app/icon-check-circle-success-16",
  },
} as const;

/**
 * Banner — system or ownership states only (info, success, warning, error).
 * Radius 8, 16 icon; title Label/S in the tone colour, optional body Body/S
 * in text/secondary, optional one ghost action on the right.
 */
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
      className={cn("flex w-full gap-3 rounded-lg border px-4 py-3", action ? "items-center" : "items-start", t.box)}
    >
      <Icon name={icon ?? t.icon} size={16} className="mt-px shrink-0 self-start" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("text-label-s", t.title)}>{title}</p>
        {children && <p className="text-body-s text-text-secondary">{children}</p>}
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
    <div className={cn("flex w-full items-start gap-2.5 rounded-lg px-4 py-3 text-body-s", t.box)}>
      <Icon name={t.icon} size={t.size} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
