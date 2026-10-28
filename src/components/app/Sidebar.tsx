"use client";

import { Icon } from "@/components/ui/Icon";
import { isOpenAlert, useAlerts, useApi, useMyCases } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useShell } from "./AppShell";

type CountTone = "neutral" | "critical" | "warning";

type NavItem = {
  href: string;
  label: string;
  /** Collapsed-rail label (Nav rail item). */
  short: string;
  icon: string;
  count?: number;
  countTone?: CountTone;
};

type SavedView = { id: string; name: string };

/** Figma icon drawn as a mask so it takes the shell token colour (muted / white when active). */
function NavIcon({ name, active, size = 18 }: { name: string; active: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn("shrink-0", active ? "bg-shell-nav-active-text" : "bg-shell-nav-icon")}
      style={{
        width: size,
        height: size,
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
  critical: "bg-shell-count-critical-bg text-shell-count-text",
  warning: "bg-shell-count-warning-bg text-shell-count-text",
};

function Count({ value, tone, active }: { value?: number; tone?: CountTone; active: boolean }) {
  if (value === undefined || value <= 0) return null;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-caption font-medium",
        active ? "bg-shell-count-active-bg text-shell-nav-active-text" : COUNT_BG[tone ?? "neutral"],
      )}
    >
      {value}
    </span>
  );
}

const rowState = (active: boolean) =>
  active
    ? "bg-shell-nav-active-bg text-label-s text-shell-nav-active-text"
    : "text-body-s text-shell-nav-text hover:bg-shell-nav-hover-bg";

/** Nav item — parent row (38), 18 icon, Body/S; Active is Label/S on white 10%. */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-[38px] w-full items-center gap-2 rounded-lg px-3", rowState(active))}
    >
      <NavIcon name={item.icon} active={active} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <Count value={item.count} tone={item.countTone} active={active} />
    </Link>
  );
}

/** Nav rail item — collapsed sidebar: 20 icon over a Caption Medium label, 64 × 54, red dot for counts. */
function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "relative flex h-[54px] w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1",
        active ? "bg-shell-nav-active-bg" : "hover:bg-shell-nav-hover-bg",
      )}
    >
      <NavIcon name={item.icon} active={active} size={20} />
      <span className={cn("w-full truncate text-center text-caption font-medium", active ? "text-shell-nav-active-text" : "text-shell-nav-text")}>
        {item.short}
      </span>
      {item.count !== undefined && item.count > 0 && (
        <span aria-hidden className="absolute top-2 left-10 size-2 rounded-full bg-shell-count-critical-bg" />
      )}
    </Link>
  );
}

const isActive = (pathname: string, href: string) =>
  pathname === href ||
  pathname.startsWith(`${href}/`) ||
  // Prospects live under Cases in the nav.
  (href === "/cases" && pathname.startsWith("/prospect/"));

const OPERATOR_COLOURS: Record<string, string> = {
  "Kasa Mobile": "bg-[#0f8b7a]",
  "Volta Telecom": "bg-[#e0661c]",
};

function LogoMark() {
  return (
    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#3b82f6_0%,#1d4ed8_71.4%)]">
      <Icon name="icon-activity" size={18} />
    </span>
  );
}

/**
 * Shell / Sidebar — Navy. Expanded 280 (workspace row, grouped nav with saved
 * views under Cases, help and feedback at the foot); collapsed 80 labelled rail.
 */
export function Sidebar({ operatorName: operatorFromSession, collapsed }: { operatorName: string | null; collapsed: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const shell = useShell();
  const { data: cases } = useMyCases();
  const { data: alerts } = useAlerts();
  const { data: views } = useApi<{ data: SavedView[] }>("/views");
  const openAlerts = alerts?.data.filter(isOpenAlert) ?? [];
  // Prefetch notifications for the header bell.
  useApi("/notifications");

  const operatorName = operatorFromSession ?? "Kasa Mobile";
  const savedId = pathname === "/cases" ? params.get("saved") : null;

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "Work",
      items: [
        { href: "/queue", label: "My queue", short: "Queue", icon: "nav-inbox", count: cases?.counts.mine },
        { href: "/alerts", label: "Live alerts", short: "Alerts", icon: "nav-alert", count: openAlerts.length },
        { href: "/cases", label: "Cases", short: "Cases", icon: "nav-folder" },
      ],
    },
    {
      title: "Investigate",
      items: [
        { href: "/lookup", label: "Subscriber lookup", short: "Lookup", icon: "nav-search" },
        { href: "/heatmap", label: "Heatmap", short: "Heatmap", icon: "nav-map" },
        { href: "/network", label: "Entity network", short: "Network", icon: "nav-network" },
      ],
    },
    {
      title: "Insights",
      items: [
        { href: "/overview", label: "Overview", short: "Overview", icon: "nav-overview" },
        { href: "/reports", label: "Reports", short: "Reports", icon: "nav-reports" },
      ],
    },
  ];
  const secondary = [
    ["help", "Help & support", "Help", "nav-help"],
    ["feedback", "Send feedback", "Feedback", "nav-feedback"],
  ] as const;

  if (collapsed) {
    return (
      <nav aria-label="Main" className="flex h-full w-20 shrink-0 flex-col items-center gap-1 border-r border-shell-card-border bg-shell-canvas pb-4">
        <Link href="/queue" aria-label="FraudDetection home" className="flex h-16 w-20 shrink-0 items-center justify-center border-b border-shell-card-border">
          <LogoMark />
        </Link>
        <span className="h-3 shrink-0" />
        {groups.map((g, i) => (
          <div key={g.title} className="contents">
            {i > 0 && <span aria-hidden className="h-px w-8 shrink-0 bg-shell-card-border" />}
            {g.items.map((item) => (
              <RailLink key={item.href} item={item} active={isActive(pathname, item.href) && !savedId} />
            ))}
          </div>
        ))}
        <span className="flex-1" />
        {secondary.map(([id, label, short, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => shell.open(id)}
            aria-label={label}
            className="flex h-[54px] w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1 hover:bg-shell-nav-hover-bg"
          >
            <NavIcon name={icon} active={false} size={20} />
            <span className="text-caption font-medium text-shell-nav-text">{short}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="flex h-full w-[280px] shrink-0 flex-col border-r border-shell-card-border bg-shell-canvas">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-shell-card-border px-4">
        <Link href="/queue" aria-label="FraudDetection home" className="rounded-[10px] px-3 py-2">
          <LogoMark />
        </Link>
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "flex size-[26px] shrink-0 items-center justify-center rounded-full text-label-m text-text-inverse",
              OPERATOR_COLOURS[operatorName] ?? "bg-brand-primary",
            )}
          >
            {operatorName[0]}
          </span>
          <span className="truncate text-label-m text-shell-text">{operatorName}</span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pt-5">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            <p className="pb-1.5 pl-3 text-caption font-medium text-shell-text-muted">{g.title}</p>
            {g.items.map((item) => (
              <div key={item.href} className="contents">
                <NavLink item={item} active={isActive(pathname, item.href) && !(item.href === "/cases" && savedId)} />
                {item.href === "/cases" && !!views?.data.length && (
                  <>
                    <p className="pt-1.5 pb-0.5 pl-10 text-caption text-shell-text-muted">Saved views</p>
                    {views.data.map((v) => {
                      const active = savedId === v.id;
                      return (
                        <Link
                          key={v.id}
                          href={`/cases?saved=${v.id}`}
                          aria-current={active ? "page" : undefined}
                          className={cn("flex h-9 w-full items-center rounded-lg pr-3 pl-[38px]", rowState(active))}
                        >
                          <span className="min-w-0 flex-1 truncate">{v.name}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5 px-3 pt-2 pb-4">
        {secondary.map(([id, label, , icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => shell.open(id)}
            className="flex h-[38px] w-full items-center gap-2 rounded-lg px-3 text-left text-body-s text-shell-nav-text hover:bg-shell-nav-hover-bg"
          >
            <NavIcon name={icon} active={false} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
