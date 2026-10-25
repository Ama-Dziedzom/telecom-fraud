"use client";

import { Icon } from "@/components/ui/Icon";
import { isOpenAlert, useAlerts, useApi, useMyCases } from "@/lib/api/fd";
import type { User } from "@/lib/auth/api";
import { roleLabel } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProfileMenu } from "@/components/shell/ShellDialogs";
import { useShell } from "./AppShell";

type CountTone = "neutral" | "critical" | "warning";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  count?: number;
  countTone?: CountTone;
};

/** Figma icon drawn as a mask so it takes the shell token colour (muted / white when active). */
function NavIcon({ name, active }: { name: string; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("size-[18px] shrink-0", active ? "bg-shell-nav-active-text" : "bg-shell-nav-icon")}
      style={{
        maskImage: `url(/figma/app/${name}.svg)`,
        WebkitMaskImage: `url(/figma/app/${name}.svg)`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}

const COUNT_BG: Record<CountTone, string> = {
  neutral: "bg-shell-count-bg text-shell-count-text",
  critical: "bg-shell-count-critical-bg text-white",
  warning: "bg-shell-count-warning-bg text-white",
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-body-m font-medium",
        active
          ? "bg-shell-nav-active-bg text-shell-nav-active-text"
          : "text-shell-nav-text hover:bg-shell-nav-hover-bg",
      )}
    >
      <NavIcon name={item.icon} active={active} />
      <span className="flex-1">{item.label}</span>
      {item.count !== undefined && item.count > 0 && (
        <span
          className={cn(
            "rounded-full px-[7px] py-px text-caption font-medium",
            active ? "bg-shell-count-active-bg text-shell-nav-active-text" : COUNT_BG[item.countTone ?? "neutral"],
          )}
        >
          {item.count}
        </span>
      )}
    </Link>
  );
}

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2.5 pb-1.5 text-overline text-shell-text-muted uppercase">{title}</p>
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          // Prospects live under Cases in the nav.
          active={pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/cases" && pathname.startsWith("/prospect/"))}
        />
      ))}
    </div>
  );
}

const OPERATOR_COLOURS: Record<string, string> = {
  "Kasa Mobile": "bg-[#0f8b7a]",
  "Volta Telecom": "bg-[#e0661c]",
};

/** Sidebar — brand, workspace, role navigation, secondary nav and the user card. */
export function Sidebar({ user, operatorName: operatorFromSession }: { user: User | null; operatorName: string | null }) {
  const pathname = usePathname();
  const shell = useShell();
  const [menu, setMenu] = useState(false);
  const menuRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) => !menuRoot.current?.contains(e.target as Node) && setMenu(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  const { data: cases } = useMyCases();
  const { data: alerts } = useAlerts();
  const openAlerts = alerts?.data.filter(isOpenAlert) ?? [];
  // Prefetch notifications for the header bell.
  useApi("/notifications");

  const operatorName = operatorFromSession ?? "Kasa Mobile";
  const initials =
    user?.name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("") ?? "";

  return (
    <nav
      aria-label="Main"
      className="flex h-full w-[300px] shrink-0 flex-col gap-[22px] bg-shell-canvas pt-6 pr-4 pb-5 pl-5"
    >
      <div className="flex flex-col gap-4 rounded-[14px] px-3 pt-3.5 pb-3">
        <Link href="/queue" className="flex w-fit items-center gap-2.5 rounded-[10px] pr-3 pl-1">
          <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#6a5ff0_0%,#3e359b_71.4%)]">
            <Icon name="icon-activity" size={18} />
          </span>
          <span className="text-h3">
            <span className="text-shell-text">Fraud</span>
            <span className="text-logo-accent">Detection</span>
          </span>
        </Link>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-shell-card-border bg-shell-card-bg px-3 py-2.5">
          <span
            aria-hidden
            className={cn(
              "flex size-[26px] items-center justify-center rounded-full text-label-m text-white",
              OPERATOR_COLOURS[operatorName] ?? "bg-brand-primary",
            )}
          >
            {operatorName[0]}
          </span>
          <span className="text-label-m text-shell-text">{operatorName}</span>
          <span className="ml-auto text-caption text-shell-text-muted">Workspace</span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <NavGroup
          title="Work"
          pathname={pathname}
          items={[
            { href: "/queue", label: "My queue", icon: "nav-inbox", count: cases?.counts.mine },
            { href: "/alerts", label: "Live alerts", icon: "nav-alert", count: openAlerts.length, countTone: "critical" },
            { href: "/cases", label: "Cases", icon: "nav-folder" },
          ]}
        />
        <NavGroup
          title="Investigate"
          pathname={pathname}
          items={[
            { href: "/lookup", label: "Subscriber lookup", icon: "nav-search" },
            { href: "/heatmap", label: "Heatmap", icon: "nav-map" },
            { href: "/network", label: "Entity network", icon: "nav-network" },
          ]}
        />
        <NavGroup
          title="Insights"
          pathname={pathname}
          items={[
            { href: "/overview", label: "Overview", icon: "nav-overview" },
            { href: "/reports", label: "Reports", icon: "nav-reports" },
          ]}
        />
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-0.5">
        {(
          [
            ["help", "Help & support", "nav-help"],
            ["feedback", "Send feedback", "nav-feedback"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => shell.open(id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body-m font-medium text-shell-nav-text hover:bg-shell-nav-hover-bg"
          >
            <NavIcon name={icon} active={false} />
            {label}
          </button>
        ))}
      </div>

      <div ref={menuRoot} className="relative">
        <button
          type="button"
          onClick={() => setMenu((o) => !o)}
          aria-expanded={menu}
          aria-haspopup="menu"
          className="flex w-full items-center text-left gap-2.5 rounded-xl border border-shell-card-border bg-shell-card-bg px-2.5 py-3 hover:bg-shell-nav-hover-bg"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-shell-nav-active-bg text-label-s text-shell-nav-active-text">
            {initials}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-label-m text-shell-text">{user?.name ?? " "}</span>
            <span className="text-caption text-shell-text-muted">{user ? roleLabel(user.role) : " "}</span>
          </span>
          <Icon name="app/icon-chevrons-up-down" size={16} className="ml-auto shrink-0" />
        </button>
        {menu && (
          <ProfileMenu
            user={user}
            operator={operatorName}
            onClose={() => setMenu(false)}
            onHandover={() => {
              setMenu(false);
              shell.handOver();
            }}
            onShortcuts={() => {
              setMenu(false);
              shell.open("shortcuts");
            }}
            onSignOut={shell.signOutNow}
          />
        )}
      </div>
    </nav>
  );
}
