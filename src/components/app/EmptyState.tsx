import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Empty / error state (Foundations · Empty state, Error state) — neutral 40
 * tile (raised, 1px border) with a 20 icon, Title 16, one Body/S line and up
 * to two actions, centred in the list area. Never red: the page isn’t in
 * error, the request is. Optional meta line (error ID) underneath.
 *
 * Standalone it sits in a white card; pass `bare` when it already lives
 * inside a card or panel.
 */
export function EmptyState({
  icon,
  title,
  children,
  actions,
  meta,
  className,
  bare = false,
}: {
  icon: string;
  /** @deprecated Direction v2 tiles are always neutral; kept so existing callers compile. */
  tone?: "critical" | "medium" | "success" | "brand" | "neutral";
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  /** @deprecated One size in Direction v2. */
  size?: "lg" | "md";
  /** No card chrome — for states inside a card, panel or dialog. */
  bare?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-8 py-10 text-center",
        !bare && "rounded-lg border border-border-default bg-surface-base",
        className,
      )}
    >
      {/* icon-tint masks whatever icon the caller passes into the neutral tertiary colour. */}
      <span className="icon-tint flex size-10 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-raised text-text-tertiary">
        <Icon name={icon} size={20} />
      </span>
      <div className="flex max-w-[400px] flex-col items-center gap-1">
        <h2 className="text-title text-text-primary">{title}</h2>
        {children && <p className="text-body-s text-text-secondary">{children}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      {meta}
    </div>
  );
}

/** “Error ID ERR-… · 28 Oct, 09:42 · quote this if you raise an IT ticket” — Caption, tertiary. */
export function ErrorId({ id, at }: { id: string; at?: string }) {
  return (
    <p className="mt-6 text-caption text-text-tertiary">
      Error ID <span className="font-mono text-mono-s text-text-secondary">{id}</span>
      {at ? ` · ${at}` : ""} · quote this if you raise an IT ticket
    </p>
  );
}
