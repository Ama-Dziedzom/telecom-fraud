"use client";

import { EnvironmentPill } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { isOpenAlert, useAlerts, useNotifications } from "@/lib/api/fd";
import Link from "next/link";
import { NotificationsPanel } from "@/components/shell/NotificationsPanel";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useShell } from "./AppShell";

/** Global search — opens the ⌘K palette (I1). */
function GlobalSearch() {
  const { open } = useShell();
  return (
    <button
      type="button"
      onClick={() => open("palette")}
      aria-label="Search"
      aria-keyshortcuts="Meta+K"
      className="flex h-10 w-[420px] min-w-0 items-center gap-2.5 rounded-[10px] border border-border-default bg-surface-base px-3 text-left hover:border-border-strong"
    >
      <Icon name="app/icon-search" size={18} />
      <span className="min-w-0 flex-1 truncate text-body-m text-text-tertiary">Search MSISDN, case ID, IMEI or name…</span>
      <kbd className="rounded-[5px] border border-border-default bg-surface-sunken px-1.5 py-0.5 font-mono text-mono-s text-text-secondary">⌘K</kbd>
    </button>
  );
}

/** Bell + I3/I4 panel; closes on Esc or a click outside. */
function Bell({ unread }: { unread: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={unread ? "Notifications (unread)" : "Notifications"} className={iconButton}>
        <Icon name="app/icon-bell" size={20} />
        {unread && <span className="absolute top-[7px] left-[22px] size-[9px] rounded-full border-2 border-surface-base bg-critical-fg" />}
      </button>
      {open && <NotificationsPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

const iconButton =
  "relative flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-default bg-surface-base hover:bg-surface-raised";

/** Header — 76 high: sidebar toggle + title block left; search, env, status pill, bell right. */
export function AppHeader({ section, title, actions }: { section: string; title: string; actions?: ReactNode }) {
  const { toggleSidebar } = useShell();
  const { data: alerts } = useAlerts();
  const { data: notifications } = useNotifications();
  const openAlerts = alerts?.data.filter(isOpenAlert).length ?? 0;
  const unread = notifications?.data.some((n) => !n.read) ?? false;

  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-border-subtle px-7">
      <div className="flex items-center gap-3.5">
        <button type="button" onClick={toggleSidebar} aria-label="Toggle sidebar" className={iconButton}>
          <Icon name="app/icon-sidebar" size={20} />
        </button>
        <div className="flex flex-col">
          <span className="text-caption text-text-tertiary">{section}</span>
          <h1 className="text-h3 text-text-primary">{title}</h1>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        {actions}
        <GlobalSearch />
        <EnvironmentPill env="production" />
        {openAlerts > 0 && (
          <Link
            href="/alerts"
            className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-critical-border bg-critical-bg px-3 text-label-s text-critical-fg"
          >
            <Icon name="app/icon-alert-triangle-critical-16" size={16} />
            Live alerts
            <span className="rounded-full bg-critical-fg px-[7px] py-px text-caption font-medium text-text-inverse">
              {openAlerts}
            </span>
          </Link>
        )}
        <Bell unread={unread} />
      </div>
    </header>
  );
}
