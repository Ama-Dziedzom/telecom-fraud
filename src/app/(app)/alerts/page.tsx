"use client";

import { AlertDrawer } from "@/components/alerts/AlertDrawer";
import {
  AlertFilterButton,
  NO_FILTER,
  SegmentChips,
  ToolbarSearch,
  matchesFilter,
  type AlertFilter,
} from "@/components/alerts/AlertFilters";
import { AttachModal, DismissModal, PromoteModal } from "@/components/alerts/TriageModals";
import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead, useFeed, useShell } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { SeverityBadge } from "@/components/app/indicators";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { useCase } from "@/lib/api/cases";
import {
  fraudTypeLabel,
  isOpenAlert,
  patchAlert,
  regionOf,
  useAlert,
  useAlerts,
  type Alert,
  type BulkTriageResult,
  type Severity,
} from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, useNow } from "@/lib/time";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

type SeverityTab = "all" | Severity;
type RowAction = "dismiss" | "promote" | "attach";
type SortKey = "time" | "risk";

const PAGE_SIZE = 9;

const SEVERITY_TABS: Array<{ id: SeverityTab; label: string; severity?: Severity }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical", severity: "critical" },
  { id: "high", label: "High", severity: "high" },
  { id: "medium", label: "Medium", severity: "medium" },
  { id: "low", label: "Low", severity: "low" },
];

const STATUS: Record<Alert["status"], { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "info" },
  seen: { label: "Seen", tone: "neutral" },
  locked: { label: "Being triaged", tone: "neutral" },
  auto_case: { label: "Auto-case", tone: "brand" },
  promoted: { label: "Case", tone: "brand" },
  attached: { label: "Added to", tone: "neutral" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

/** Status link — the pill, and the case the alert went to in brand mono (opens the case). */
function StatusCell({ alert }: { alert: Alert }) {
  const s = STATUS[alert.status] ?? { label: alert.status, tone: "neutral" as const };
  return (
    <span className="flex items-center gap-2">
      <Badge label={s.label} tone={s.tone} />
      {alert.case_id && !isOpenAlert(alert) && (
        <Link
          href={`/cases/${alert.case_id}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded font-mono text-mono-s text-text-brand hover:underline"
        >
          {alert.case_id}
        </Link>
      )}
    </span>
  );
}

/** CSV of what’s on screen, for “Export”. */
function exportCsv(rows: Alert[]) {
  const head = ["id", "created_at", "severity", "risk_score", "title", "rules", "msisdn", "region", "status", "case_id"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((a) =>
    [a.id, a.created_at, a.severity, a.risk_score, a.title, a.rule_ids.join(" "), a.subscriber.msisdn, a.region, a.status, a.case_id]
      .map(esc)
      .join(","),
  );
  const url = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `live-alerts-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

/** B2 · The critical alert that just opened a case, as a banner on this page (B3’s toast stays away from here). */
function CriticalBanner({ alertId, caseId, onOpen }: { alertId: string; caseId: string; onOpen: () => void }) {
  const { data: detail } = useAlert(alertId);
  const { data: opened } = useCase(caseId);
  const due = opened?.sla?.first_response_due_at;
  return (
    <Banner
      tone="error"
      title={`Critical alert: case ${caseId} opened and assigned to you`}
      action={
        <Link href={`/cases/${caseId}`} onClick={onOpen} className="shrink-0 rounded px-2 text-label-s text-text-brand hover:underline">
          Open {caseId}
        </Link>
      }
    >
      {detail &&
        [`${detail.title} on ${detail.subscriber.msisdn}`, `risk ${detail.risk_score}`, due && `first response due ${formatClock(due)}`]
          .filter(Boolean)
          .join(" · ")}
    </Banner>
  );
}

/** Table header cell — Caption sentence case; the sorted column is Caption Medium, primary. */
function HeaderCell({
  children,
  sort,
  onSort,
  className,
}: {
  children?: ReactNode;
  sort?: "sorted" | "sortable";
  onSort?: () => void;
  className?: string;
}) {
  const sorted = sort === "sorted";
  return (
    <th
      scope="col"
      aria-sort={sorted ? "descending" : undefined}
      className={cn("h-10 px-4 text-left text-caption font-normal", sorted ? "font-medium text-text-primary" : "text-text-secondary", className)}
    >
      {sort ? (
        <button type="button" onClick={onSort} className="flex items-center gap-1 rounded">
          {children}
          <Icon name={sorted ? "app/icon-sort-desc-primary-14" : "app/icon-sort-tertiary-14"} size={14} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/** Pagination — the table’s last row: “Showing 1-9 of 23”, previous, pages, next. One page: just the count. */
function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const numbers =
    pages <= 7
      ? Array.from({ length: pages }, (_, i) => i)
      : Array.from(new Set([0, page - 1, page, page + 1, pages - 1])).filter((p) => p >= 0 && p < pages);
  return (
    <nav aria-label="Pages" className="flex h-14 items-center gap-1 border-t border-border-default pr-3 pl-4">
      <p className="flex-1 text-body-s text-text-secondary">
        {pages > 1 ? `Showing ${from}-${to} of ${total}` : `${total} ${total === 1 ? "alert" : "alerts"}`}
      </p>
      {pages > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            className="flex size-8 items-center justify-center rounded-lg enabled:hover:bg-surface-sunken disabled:cursor-not-allowed"
          >
            <Icon name={page === 0 ? "app/icon-chevron-left-disabled-16" : "app/icon-chevron-left-16"} size={16} />
          </button>
          {numbers.map((p, i) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && p - numbers[i - 1] > 1 && <span className="px-1 text-body-s text-text-tertiary">…</span>}
              <button
                type="button"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPage(p)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  p === page ? "bg-brand-primary-subtle text-label-s text-text-brand" : "text-body-s text-text-secondary hover:bg-surface-sunken",
                )}
              >
                {p + 1}
              </button>
            </span>
          ))}
          <button
            type="button"
            aria-label="Next page"
            disabled={page === pages - 1}
            onClick={() => onPage(page + 1)}
            className="flex size-8 items-center justify-center rounded-lg enabled:hover:bg-surface-sunken disabled:cursor-not-allowed"
          >
            <Icon name={page === pages - 1 ? "app/icon-chevron-left-disabled-16" : "app/icon-chevron-right-primary-16"} size={16} className={cn("shrink-0", page === pages - 1 && "rotate-180")} />
          </button>
        </>
      )}
    </nav>
  );
}

/** B1–B20 · Live alerts */
export default function LiveAlertsPage() {
  const now = useNow(5_000);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const feed = useFeed();
  const toast = useToast();
  const { user } = useShell();
  const { data, isLoading } = useAlerts();

  const [severity, setSeverity] = useState<SeverityTab>("all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AlertFilter>(NO_FILTER);
  const [myRegions, setMyRegions] = useState(false);
  const [sort, setSort] = useState<SortKey>("time");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<RowAction | null>(null);
  const [rowAction, setRowAction] = useState<RowAction | null>(null);

  const openId = params.get("alert");
  const all = useMemo(
    () => (data?.data ?? []).slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [data],
  );
  const openAlerts = all.filter(isOpenAlert);

  const q = query.trim().toLowerCase();
  const rows = all
    .filter(
      (a) =>
        a.status !== "dismissed" &&
        (severity === "all" || a.severity === severity) &&
        matchesFilter(a, filter) &&
        (!myRegions || !user?.regions || user.regions.includes(regionOf(a.region))) &&
        (!q || [a.id, a.title, a.subscriber.msisdn, a.region, ...a.rule_ids].some((v) => v.toLowerCase().includes(q))),
    )
    .sort((a, b) => (sort === "risk" ? b.risk_score - a.risk_score : 0));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  /** Any change to what’s listed starts again on page 1. */
  const refine =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(0);
    };

  const severityCount = (s: Severity) => openAlerts.filter((a) => a.severity === s).length;
  const openDrawer = (id: string | null, action: RowAction | null = null) => {
    setRowAction(action);
    const next = new URLSearchParams(params);
    if (id) next.set("alert", id);
    else next.delete("alert");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  // A link can open an alert that isn’t in the live list (older, or from search): the detail stands in for the row.
  const listed = openId ? all.find((a) => a.id === openId) : undefined;
  const { data: unlisted } = useAlert(openId && data && !listed ? openId : null);
  const drawerAlert = listed ?? (unlisted?.id === openId ? unlisted : undefined);

  const picked = rows.filter((a) => selected.has(a.id) && isOpenAlert(a));
  const selectable = pageRows.filter(isOpenAlert);
  const allPicked = selectable.length > 0 && selectable.every((a) => selected.has(a.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const sameAs = <T,>(get: (a: Alert) => T) => picked.length > 1 && picked.every((a) => get(a) === get(picked[0]));
  const commonality = [
    sameAs((a) => a.fraud_type) && `All ${fraudTypeLabel(picked[0].fraud_type)}`,
    sameAs((a) => a.rule_ids[0]) && picked[0].rule_ids[0],
    sameAs((a) => a.region) && picked[0].region,
  ].filter(Boolean);

  const disconnected = feed.status === "reconnecting";
  const lastUpdate = formatClock(feed.lastEventAt ?? now);
  const subtitle =
    disconnected
      ? `Disconnected · ${openAlerts.length} open · last update ${formatClock(feed.since ?? feed.lastEventAt ?? now)}`
      : feed.status === "paused"
        ? `Paused · ${openAlerts.length} open · new alerts are held until you resume`
        : `Streaming · ${openAlerts.length} open · updated ${lastUpdate}`;

  const allClear = !isLoading && openAlerts.length === 0;
  // TODO(api): alerts carry no triaged-at time, so “last alert” is the newest alert’s arrival.
  const lastAlertAt = all[0]?.created_at;

  return (
    <>
      <AppHeader section="Work" title="Live alerts" />
      <PageBody>
        <PageHead
          title="Live alerts"
          subtitle={subtitle}
          actions={
            <>
              {!disconnected && (
                <Button variant="secondary" size="md" onClick={() => feed.setPaused(feed.status !== "paused")}>
                  {feed.status === "paused" ? "Resume stream" : "Pause stream"}
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={() => exportCsv(rows)} disabled={!rows.length}>
                Export
              </Button>
            </>
          }
        />

        {/* B19 · Stream disconnected */}
        {disconnected && (
          <Banner
            tone="error"
            title="Live stream disconnected"
            action={
              <button type="button" onClick={feed.reconnect} className="shrink-0 rounded px-2 text-label-s text-text-brand hover:underline">
                Retry now
              </button>
            }
          >
            {/* TODO(api): the stream gives no retry schedule, so there’s no “in 8 s” countdown. */}
            Reconnecting{feed.attempt > 1 ? ` (attempt ${feed.attempt})` : ""}. You are seeing alerts up to {formatClock(feed.since ?? now)}.
          </Banner>
        )}
        {feed.critical?.case_id && !disconnected && (
          <CriticalBanner alertId={feed.critical.id} caseId={feed.critical.case_id} onOpen={feed.dismissCritical} />
        )}

        {picked.length > 0 ? (
          /* B15 · Bulk triage */
          <div
            role="toolbar"
            aria-label="Bulk actions"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-primary bg-brand-primary-subtle py-2.5 pr-3 pl-4"
          >
            <Checkbox
              label="Clear selection"
              hideLabel
              checked={allPicked}
              indeterminate={!allPicked}
              onChange={() => setSelected(new Set())}
            />
            <p className="flex items-center gap-2">
              <span className="text-label-s text-text-primary">
                {picked.length} {picked.length === 1 ? "alert" : "alerts"} selected
              </span>
              {commonality.length > 0 && <span className="text-body-s text-text-secondary">{commonality.join(" · ")}</span>}
            </p>
            <span className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => setBulk("promote")}>
              {picked.length > 1 ? `Open one case for all ${picked.length}` : "Open a case"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulk("attach")}>
              Add to a case
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulk("dismiss")}>
              Dismiss {picked.length}
            </Button>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => setSelected(new Set())}
              className="flex size-8 items-center justify-center rounded-lg hover:bg-brand-primary-subtle-hover"
            >
              <Icon name="app/icon-x-primary-18" size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarSearch
              label="Search alerts"
              placeholder="Search alerts by MSISDN, rule or ID"
              value={query}
              onChange={refine(setQuery)}
            />
            <AlertFilterButton
              value={filter}
              onChange={refine(setFilter)}
              alerts={openAlerts}
              onSaveView={() =>
                // TODO(api): saved views have no endpoint yet (also needed by G5).
                toast({ title: "Saved views are coming soon", body: "Your filters are applied for now." })
              }
            />
            <span aria-hidden className="h-5 w-px bg-border-strong" />
            <SegmentChips
              label="Severity"
              value={severity}
              onChange={refine(setSeverity)}
              options={SEVERITY_TABS.map((t) => ({ ...t, count: t.id === "all" ? openAlerts.length : severityCount(t.id) }))}
            />
            <span className="flex-1" />
            <Toggle
              label="My regions only"
              checked={myRegions}
              disabled={!user?.regions}
              title={user?.regions ? user.regions.join(", ") : undefined}
              onChange={(e) => refine(setMyRegions)(e.target.checked)}
            />
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border-default bg-surface-base">
          <table className="w-full table-fixed">
            <thead className="border-b border-border-default bg-surface-raised">
              <tr>
                {!allClear && (
                  <th scope="col" className="h-10 w-12 pr-2 pl-4">
                    <Checkbox
                      label="Select all open alerts on this page"
                      hideLabel
                      checked={allPicked}
                      indeterminate={picked.length > 0 && !allPicked}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          selectable.forEach((a) => (e.target.checked ? next.add(a.id) : next.delete(a.id)));
                          return next;
                        })
                      }
                    />
                  </th>
                )}
                <HeaderCell className="w-[88px]" sort={sort === "time" ? "sorted" : "sortable"} onSort={() => setSort("time")}>
                  Time
                </HeaderCell>
                <HeaderCell className="w-[140px]" sort={sort === "risk" ? "sorted" : "sortable"} onSort={() => setSort("risk")}>
                  Risk
                </HeaderCell>
                <HeaderCell>Signal</HeaderCell>
                <HeaderCell className="w-[220px]">Subscriber</HeaderCell>
                <HeaderCell className="w-[240px]">Status</HeaderCell>
                <th scope="col" className="w-14">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-border-default last:border-b-0">
                    <td colSpan={7} className="h-16 px-4">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {/* B18 · All clear */}
              {allClear && (
                <tr>
                  <td colSpan={6} className="px-4 py-9">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="mb-3 flex size-9 items-center justify-center rounded-lg border border-border-default bg-surface-base">
                        <Icon name="app/icon-check-circle-secondary-18" size={18} />
                      </span>
                      <p className="text-title text-text-primary">No new alerts</p>
                      <p className="text-caption text-text-secondary">
                        {[lastAlertAt && `Last alert at ${formatClock(lastAlertAt)}`, feed.status === "live" ? "the stream is live" : "the stream is paused"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {!allClear &&
                pageRows.map((a) => {
                  const isOpen = isOpenAlert(a);
                  const checked = selected.has(a.id);
                  const active = checked || a.id === openId;
                  const tone = isOpen ? "text-text-primary" : "text-text-secondary";
                  return (
                    <tr
                      key={a.id}
                      onClick={() => openDrawer(a.id)}
                      className={cn(
                        "h-16 cursor-pointer border-b border-border-default last:border-b-0",
                        active ? "bg-brand-primary-subtle-hover" : "bg-surface-base hover:bg-surface-sunken",
                        feed.arrived.has(a.id) && "animate-row-arrive motion-reduce:animate-none",
                      )}
                    >
                      <td className="pr-2 pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          label={`Select ${a.id}`}
                          hideLabel
                          disabled={!isOpen}
                          checked={checked && isOpen}
                          onChange={(e) => toggle(a.id, e.target.checked)}
                        />
                      </td>
                      <td className={cn("px-4 text-body-s", tone)}>{formatClock(a.created_at)}</td>
                      <td className="px-4">
                        <span className="flex items-center gap-2">
                          <span className={cn("w-5 text-right text-body-s tabular-nums", tone)}>{a.risk_score}</span>
                          <SeverityBadge severity={a.severity} />
                        </span>
                      </td>
                      <td className="px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(a.id);
                          }}
                          className="flex w-full min-w-0 flex-col gap-0.5 rounded text-left"
                        >
                          <span className={cn("w-full truncate text-label-s", tone)}>{a.title}</span>
                          <span className="w-full truncate text-caption text-text-tertiary">{a.id}</span>
                        </button>
                      </td>
                      <td className="px-4">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className={cn("truncate text-label-s", tone)}>{a.subscriber.msisdn}</span>
                          <span className="truncate text-caption text-text-tertiary">{a.region}</span>
                        </span>
                      </td>
                      <td className="px-4">
                        <StatusCell alert={a} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {isOpen && (
                          <span className="flex justify-center">
                            <Menu
                              label={`More actions for ${a.id}`}
                              width={200}
                              compact
                              trigger={(t) => (
                                <button
                                  type="button"
                                  aria-label={`More actions for ${a.id}`}
                                  aria-expanded={t["aria-expanded"]}
                                  aria-haspopup="menu"
                                  onClick={t.toggle}
                                  className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken"
                                >
                                  <Icon name="app/icon-more-16" size={16} />
                                </button>
                              )}
                            >
                              {(close) =>
                                (
                                  [
                                    ["promote", "Open a case", "app/menu-open-16"],
                                    ["attach", "Add to a case", "app/icon-folder-secondary-16"],
                                    ["dismiss", "Dismiss", "app/icon-x-secondary-16"],
                                  ] as const
                                ).map(([id, label, icon]) => (
                                  <MenuItem
                                    key={id}
                                    icon={icon}
                                    title={label}
                                    onSelect={() => {
                                      close();
                                      openDrawer(a.id, id);
                                    }}
                                  />
                                ))
                              }
                            </Menu>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {!isLoading && !allClear && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-body-s text-text-secondary">
                    No alerts match.{" "}
                    <button
                      type="button"
                      className="text-text-brand hover:underline"
                      onClick={() => {
                        setFilter(NO_FILTER);
                        setSeverity("all");
                        setQuery("");
                        setMyRegions(false);
                        setPage(0);
                      }}
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!isLoading && !allClear && rows.length > 0 && (
            <Pagination page={current} pages={pages} total={rows.length} onPage={setPage} />
          )}
        </div>
      </PageBody>

      {drawerAlert && (
        <AlertDrawer
          key={`${drawerAlert.id}:${rowAction}`}
          alert={drawerAlert}
          all={all}
          now={now}
          initialDialog={rowAction}
          onClose={() => openDrawer(null)}
        />
      )}

      {bulk && picked.length > 0 && (
        <BulkDialogs
          action={bulk}
          picked={picked}
          me={user ? { name: user.name, shift: user.shift } : null}
          onClose={() => setBulk(null)}
          onDone={(message) => {
            setBulk(null);
            setSelected(new Set());
            toast({ tone: "success", ...message });
          }}
        />
      )}
    </>
  );
}

/** “AL-88195 is being triaged by Kofi Boateng” — the alerts a bulk call left out, and why. */
function failures(result?: BulkTriageResult) {
  return (result?.failed ?? [])
    .map((f) => (f.code === "locked" && f.locked_by ? `${f.id} is being triaged by ${f.locked_by.name}` : `${f.id} couldn’t be changed`))
    .join(". ");
}

/** B15 · Bulk triage — one decision for every selected alert. */
function BulkDialogs({
  action,
  picked,
  me,
  onClose,
  onDone,
}: {
  action: RowAction;
  picked: Alert[];
  me: { name: string; shift?: string } | null;
  onClose: () => void;
  onDone: (message: { title: string; body?: string; action?: { label: string; onClick: () => void } }) => void;
}) {
  const router = useRouter();
  const [first, ...others] = picked;
  const ids = picked.map((a) => a.id);
  // Everything that didn’t fail went through (the bulk call answers for each alert on its own).
  const succeeded = (result?: BulkTriageResult) => ids.filter((id) => !result?.failed.some((f) => f.id === id));

  if (action === "dismiss") {
    return (
      <DismissModal
        alert={first}
        others={others}
        open
        onClose={onClose}
        onDone={(_reason, _feedback, result) => {
          const done = succeeded(result);
          done.forEach((id) => patchAlert(id, { status: "dismissed" }));
          onDone({
            title: `${done.length} ${done.length === 1 ? "alert" : "alerts"} dismissed`,
            body: [done.join(", "), failures(result)].filter(Boolean).join(". "),
            action: { label: "Undo", onClick: () => done.forEach((id) => patchAlert(id, null)) },
          });
        }}
      />
    );
  }
  if (action === "attach") {
    return (
      <AttachModal
        alert={first}
        others={others}
        open
        onClose={onClose}
        onDone={(caseId, result) => {
          const done = succeeded(result);
          done.forEach((id) => patchAlert(id, { status: "attached", case_id: caseId }));
          onDone({
            title: `${done.length} ${done.length === 1 ? "alert" : "alerts"} added to ${caseId}`,
            body: failures(result) || undefined,
            action: { label: "Open case", onClick: () => router.push(`/cases/${caseId}`) },
          });
        }}
      />
    );
  }
  return (
    <PromoteModal
      alert={first}
      related={others}
      relatedTitle={`${others.length} more selected ${others.length === 1 ? "alert" : "alerts"}`}
      me={me}
      open
      onClose={onClose}
      onDone={(caseId) => {
        patchAlert(first.id, { status: "promoted", case_id: caseId });
        others.forEach((a) => patchAlert(a.id, { status: "attached", case_id: caseId }));
        onDone({
          title: `Case ${caseId} opened for ${ids.length} alerts`,
          body: "Assigned to you.",
          action: { label: "Open case", onClick: () => router.push(`/cases/${caseId}`) },
        });
      }}
    />
  );
}
