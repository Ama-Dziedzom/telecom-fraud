"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useNotifications } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
import { NotificationsPanel } from "@/components/shell/NotificationsPanel";
import { ProfileMenu } from "@/components/shell/ShellDialogs";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useShell } from "./AppShell";

/** Closes a popover on Esc or a pointer-down outside `root`. */
function useDismiss(open: boolean, root: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !root.current?.contains(e.target as Node) && close();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, root, close]);
}

/** Global search — opens the ⌘K palette (I1). */
function GlobalSearch() {
  const { open } = useShell();
  return (
    <button
      type="button"
      onClick={() => open("palette")}
      aria-label="Search"
      aria-keyshortcuts="Meta+K"
      className="flex h-10 w-[420px] min-w-0 items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 text-left hover:border-border-strong"
    >
      <Icon name="app/icon-search" size={16} />
      <span className="min-w-0 flex-1 truncate text-body-s text-text-tertiary">Search MSISDN, case ID, IMEI or name…</span>
      <kbd className="rounded border border-border-default bg-surface-sunken px-1.5 py-0.5 font-sans text-caption font-medium text-text-secondary">⌘K</kbd>
    </button>
  );
}

const iconButton =
  "relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-base hover:bg-surface-raised";

/** Bell + I3/I4 panel. */
function Bell({ unread }: { unread: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(open, root, () => setOpen(false));
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

/** Avatar + I5 profile menu. */
function Account() {
  const shell = useShell();
  const operator = useOperatorName() ?? "Kasa Mobile";
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(open, root, () => setOpen(false));
  const initials =
    shell.user?.name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("") ?? "";
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account" className="flex rounded-full">
        <Avatar initials={initials} size={32} />
      </button>
      {open && (
        <ProfileMenu
          user={shell.user}
          operator={operator}
          onClose={() => setOpen(false)}
          onHandover={() => {
            setOpen(false);
            shell.handOver();
          }}
          onShortcuts={() => {
            setOpen(false);
            shell.open("shortcuts");
          }}
          onSignOut={shell.signOutNow}
        />
      )}
    </div>
  );
}

/**
 * Shell / Top bar — 64 high: sidebar toggle + search left; notifications and
 * account right. No visible page title (the page header carries it); `title`
 * stays as the document heading for screen readers.
 */
export function AppHeader({ title, actions }: { section?: string; title: string; actions?: ReactNode }) {
  const { toggleSidebar, sidebarOpen } = useShell();
  const { data: notifications } = useNotifications();
  const unread = (notifications?.unread ?? 0) > 0;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border-default bg-surface-base px-6">
      <h1 className="sr-only">{title}</h1>
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={toggleSidebar} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={sidebarOpen} className={iconButton}>
          <Icon name="app/icon-sidebar" size={20} />
        </button>
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <Bell unread={unread} />
        <Account />
      </div>
    </header>
  );
}
