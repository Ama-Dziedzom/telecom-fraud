"use client";

import { AlertDrawer } from "@/components/alerts/AlertDrawer";
import { AlertFilterButton, NO_FILTER, matchesFilter, type AlertFilter } from "@/components/alerts/AlertFilters";
import { AttachModal, DismissModal, PromoteModal } from "@/components/alerts/TriageModals";
import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead, useFeed, useShell } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { SeverityBadge, riskText } from "@/components/app/indicators";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
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
import { formatAgo, formatClock, formatMoney, formatSpan, useNow } from "@/lib/time";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SeverityTab = "all" | Severity;
type RowAction = "dismiss" | "promote" | "attach";

const SEVERITY_TABS: Array<{ id: SeverityTab; label: string; dot?: string }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical", dot: "bg-critical-fg" },
  { id: "high", label: "High", dot: "bg-high-fg" },
  { id: "medium", label: "Medium", dot: "bg-medium-fg" },
  { id: "low", label: "Low", dot: "bg-success-fg" },
];

/** What a closed row says in the Status column. */
function ClosedStatus({ alert }: { alert: Alert }) {
  const label = { auto_case: "Auto-case", promoted: "Case", attached: "Added to", dismissed: "Dismissed" }[
    alert.status as "auto_case"
  ];
  return (
    <span className="flex items-center gap-1.5">
      <Badge label={label ?? alert.status} tone={alert.status === "auto_case" || alert.status === "promoted" ? "brand" : "neutral"} />
      {alert.case_id && <span className="font-mono text-mono-s text-text-brand">{alert.case_id}</span>}
    </span>
  );
}

function OpenStatus({ alert }: { alert: Alert }) {
  if (alert.status === "new") return <Badge label="New" tone="info" dot />;
  if (alert.status === "locked") return <Badge label="Being triaged" tone="neutral" dot />;
  return <Badge label="Seen" tone="neutral" dot />;
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

/** B2 · The critical alert that just opened a case, as a banner on this page. */
function CriticalBanner({ alertId, caseId, onOpen }: { alertId: string; caseId: string; onOpen: () => void }) {
  const { data: detail } = useAlert(alertId);
  const swap = detail?.what_happened.find((s) => s.kind === "sim_swap");
  const payments = detail?.what_happened.find((s) => s.kind === "payments_out");
  return (
    <Banner
      tone="error"
      icon="icon-alert-triangle-critical-24"
      title={`Critical alert: case ${caseId} opened and assigned to you`}
      action={
        <ButtonLink
          href={`/cases/${caseId}`}
          variant="danger"
          size="md"
          onClick={onOpen}
          iconRight={<Icon name="app/icon-arrow-right-white-16" size={16} />}
        >
          Open {caseId}
        </ButtonLink>
      }
    >
      {[
        swap && `SIM swapped at ${swap.detail.replace("Agent ", "agent ")} at ${formatClock(swap.at)}.`,
        payments?.amount && `${formatMoney(payments.amount.amount_minor, payments.amount.currency)} sent since ${formatClock(payments.at)}.`,
        "First response due within 15 minutes.",
      ]
        .filter(Boolean)
        .join(" ")}
    </Banner>
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
  const [showDismissed, setShowDismissed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<RowAction | null>(null);
  const [rowAction, setRowAction] = useState<RowAction | null>(null);

  const openId = params.get("alert");
  const all = useMemo(
    () => (data?.data ?? []).slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [data],
  );
  const visible = all.filter((a) => showDismissed || a.status !== "dismissed");
  const openAlerts = all.filter(isOpenAlert);
  const dismissedToday = all.filter((a) => a.status === "dismissed").length;

  const q = query.trim().toLowerCase();
  const rows = visible.filter(
    (a) =>
      (severity === "all" || a.severity === severity) &&
      matchesFilter(a, filter) &&
      (!myRegions || !user?.regions || user.regions.includes(regionOf(a.region))) &&
      (!q || [a.id, a.title, a.subscriber.msisdn, a.region, ...a.rule_ids].some((v) => v.toLowerCase().includes(q))),
  );
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
  const selectable = rows.filter(isOpenAlert);
  const allPicked = selectable.length > 0 && picked.length === selectable.length;
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const sameAs = <T,>(get: (a: Alert) => T) => picked.length > 1 && picked.every((a) => get(a) === get(picked[0]));
  const commonality = [
    sameAs((a) => a.fraud_type) && `all ${fraudTypeLabel(picked[0].fraud_type)}`,
    sameAs((a) => a.rule_ids[0]) && picked[0].rule_ids[0],
    sameAs((a) => a.region) && picked[0].region,
  ].filter(Boolean);

  const lastEvent = feed.lastEventAt ? formatSpan(now - feed.lastEventAt) : null;
  const subtitle =
    feed.status === "reconnecting" ? (
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-medium-fg" />
        Stream paused at {formatClock(feed.since ?? now)} · reconnecting
      </span>
    ) : feed.status === "paused" ? (
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-text-tertiary" />
        Paused by you · {openAlerts.length} open · new alerts are held until you resume
      </span>
    ) : (
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-success-fg" />
        Streaming · {openAlerts.length} open{lastEvent ? ` · updated ${lastEvent} ago` : ""}
      </span>
    );

  // B2 · also say it where the analyst is looking: bottom-right, with a shortcut.
  const critical = feed.critical;
  useEffect(() => {
    if (!critical?.case_id) return;
    toast({
      title: `Critical: case ${critical.case_id} opened automatically`,
      body: `Risk ${critical.risk_score} · assigned to you.`,
      action: { label: "Open case", onClick: () => router.push(`/cases/${critical.case_id}`) },
    });
  }, [critical, toast, router]);

  const allClear = !isLoading && openAlerts.length === 0 && !showDismissed;
  const disconnected = feed.status === "reconnecting";

  return (
    <>
      <AppHeader section="Work" title="Live alerts" />
      <PageBody>
        <PageHead
          title="Live alerts"
          subtitle={subtitle}
          actions={
            <>
              {disconnected ? (
                <Button variant="secondary" size="md" onClick={feed.reconnect} iconLeft={<Icon name="app/icon-refresh-16" size={18} />}>
                  Reconnect
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => feed.setPaused(feed.status !== "paused")}
                  iconLeft={<Icon name="app/icon-pause-18" size={18} />}
                >
                  {feed.status === "paused" ? "Resume stream" : "Pause stream"}
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={() => exportCsv(rows)} disabled={!rows.length} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
                Export
              </Button>
            </>
          }
        />

        {disconnected && (
          <Banner tone="error" title={`Live updates stopped at ${formatClock(feed.since ?? now)}`}>
            We’re trying to reconnect{feed.attempt ? ` (attempt ${feed.attempt})` : ""}. Alerts below may be out of date. Don’t treat a quiet
            list as “all clear”.
          </Banner>
        )}
        {feed.critical?.case_id && !disconnected && (
          <CriticalBanner alertId={feed.critical.id} caseId={feed.critical.case_id} onOpen={feed.dismissCritical} />
        )}

        {picked.length > 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-brand-ink px-4 py-2.5" role="toolbar" aria-label="Bulk actions">
            <Checkbox
              label={`${picked.length} selected`}
              hideLabel
              checked={allPicked}
              indeterminate={!allPicked}
              onChange={() => setSelected(new Set())}
            />
            <p className="text-label-m text-text-inverse">
              {picked.length} {picked.length === 1 ? "alert" : "alerts"} selected
              {commonality.length > 0 && <span className="text-body-s text-[#c9c6e6]"> · {commonality.join(" · ")}</span>}
            </p>
            <span className="flex-1" />
            {[
              ["promote", "app/icon-folder-white-18", picked.length > 1 ? `Open one case for all ${picked.length}` : "Open a case"],
              ["attach", "app/icon-plus-white-18", "Add to a case"],
              ["dismiss", "app/icon-x-white-18", `Dismiss ${picked.length}…`],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBulk(id as RowAction)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-label-s text-text-inverse hover:bg-white/15"
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
            <button type="button" aria-label="Clear selection" onClick={() => setSelected(new Set())} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10">
              <Icon name="app/icon-x-lilac-18" size={18} />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Severity"
              value={severity}
              onChange={setSeverity}
              options={SEVERITY_TABS.map((t) => ({
                ...t,
                count: t.id === "all" ? openAlerts.length : severityCount(t.id),
              }))}
            />
            <span className="flex-1" />
            <label className="flex h-10 w-[320px] items-center gap-2.5 rounded-lg border border-border-default bg-surface-base px-3.5 focus-within:border-border-focus focus-within:shadow-focus">
              <Icon name="app/icon-search-18" size={18} />
              <input
                type="search"
                aria-label="Search alerts"
                placeholder="Search alerts by MSISDN, rule or ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
              />
            </label>
            <AlertFilterButton
              value={filter}
              onChange={setFilter}
              alerts={openAlerts}
              onSaveView={() =>
                // TODO(api): saved views have no endpoint yet (also needed by G5).
                toast({ title: "Saved views are coming soon", body: "Your filters are applied for now." })
              }
            />
            <Toggle
              label="My regions only"
              checked={myRegions}
              disabled={!user?.regions}
              title={user?.regions ? user.regions.join(", ") : undefined}
              onChange={(e) => setMyRegions(e.target.checked)}
            />
          </div>
        )}

        {allClear ? (
          <section className="flex flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface-base px-8 py-24 text-center">
            <span className="flex size-[52px] items-center justify-center rounded-[14px] bg-success-bg">
              <Icon name="app/icon-shield-check-success-22" size={22} />
            </span>
            <h2 className="text-title text-text-primary">All clear: no open alerts</h2>
            <p className="max-w-[420px] text-body-s text-text-secondary">
              Every alert has been triaged. New ones appear here the moment they’re detected
              {feed.status === "live" && lastEvent ? ` (stream is live, last check ${lastEvent} ago)` : ""}.
            </p>
            <div className="mt-1 flex gap-2.5">
              <Button variant="secondary" size="md" onClick={() => setShowDismissed(true)} disabled={!dismissedToday}>
                View dismissed today ({dismissedToday})
              </Button>
              <ButtonLink href="/queue" size="md">
                Go to my queue
              </ButtonLink>
            </div>
          </section>
        ) : (
          <div className={cn("overflow-hidden rounded-xl border border-border-subtle bg-surface-base", disconnected && "opacity-60")}>
            <table className="w-full table-fixed text-left">
              <thead className="border-b border-border-subtle bg-surface-raised">
                <tr className="text-overline text-text-tertiary uppercase">
                  <th className="w-[54px] py-[11px] pl-5">
                    <Checkbox
                      label="Select all open alerts"
                      hideLabel
                      checked={allPicked}
                      indeterminate={picked.length > 0 && !allPicked}
                      onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((a) => a.id)) : new Set())}
                    />
                  </th>
                  <th className="w-[100px] py-[11px] font-bold">Time</th>
                  <th className="w-[166px] py-[11px] font-bold">Risk</th>
                  <th className="py-[11px] font-bold">Signal</th>
                  <th className="w-[206px] py-[11px] font-bold">Subscriber</th>
                  <th className="w-[206px] py-[11px] font-bold">Status</th>
                  <th className="w-[170px] py-[11px] pr-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="border-b border-border-subtle">
                      <td colSpan={7} className="px-5 py-4">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))}
                {rows.map((a) => {
                  const isOpen = isOpenAlert(a);
                  const fresh = a.status === "new" && now - Date.parse(a.created_at) < 5 * 60_000;
                  const checked = selected.has(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={cn(
                        "relative border-b border-border-subtle last:border-b-0",
                        checked ? "bg-brand-primary-subtle/60" : isOpen ? "bg-surface-base hover:bg-[#fbfaff]" : "bg-surface-raised",
                        feed.arrived.has(a.id) && "animate-row-arrive motion-reduce:animate-none",
                      )}
                    >
                      <td className="relative py-3.5 pl-5">
                        {(fresh || feed.arrived.has(a.id)) && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand-primary" />}
                        {isOpen && (
                          <Checkbox label={`Select ${a.id}`} hideLabel checked={checked} onChange={(e) => toggle(a.id, e.target.checked)} />
                        )}
                      </td>
                      <td className="py-3.5">
                        <span className="flex flex-col text-caption">
                          <span className="font-mono text-mono-s text-text-primary">{formatClock(a.created_at)}</span>
                          <span className="text-text-tertiary">{formatAgo(a.created_at, now)}</span>
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className="flex items-center gap-2">
                          <span className={cn("text-label-m", riskText(a.risk_score))}>{a.risk_score}</span>
                          <SeverityBadge severity={a.severity} />
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <button
                          type="button"
                          onClick={() => openDrawer(a.id)}
                          className="flex max-w-full flex-col gap-0.5 rounded text-left"
                        >
                          <span className={cn("truncate text-label-m", isOpen ? "text-text-primary" : "text-text-secondary")}>{a.title}</span>
                          <span className="truncate font-mono text-mono-s text-text-tertiary">{[a.id, ...a.rule_ids].join(" · ")}</span>
                        </button>
                      </td>
                      <td className="py-3.5">
                        <span className="flex flex-col text-caption">
                          <span className="font-mono text-mono-s text-text-primary">{a.subscriber.msisdn}</span>
                          <span className="text-text-secondary">{a.region}</span>
                        </span>
                      </td>
                      <td className="py-3.5">{isOpen ? <OpenStatus alert={a} /> : <ClosedStatus alert={a} />}</td>
                      <td className="py-3.5 pr-5">
                        <span className="flex items-center justify-end gap-1">
                          {isOpen ? (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => openDrawer(a.id)}>
                                Investigate
                              </Button>
                              <Menu
                                label={`More actions for ${a.id}`}
                                width={220}
                                trigger={(t) => (
                                  <button
                                    type="button"
                                    aria-label={`More actions for ${a.id}`}
                                    aria-expanded={t["aria-expanded"]}
                                    aria-haspopup="menu"
                                    onClick={t.toggle}
                                    className="flex size-8 items-center justify-center rounded-[10px] border border-border-default bg-surface-base hover:bg-surface-raised"
                                  >
                                    <Icon name="app/icon-more-20" size={20} />
                                  </button>
                                )}
                              >
                                {(close) =>
                                  (
                                    [
                                      ["promote", "Open a case"],
                                      ["attach", "Add to a case"],
                                      ["dismiss", "Dismiss"],
                                    ] as const
                                  ).map(([id, label]) => (
                                    <MenuItem
                                      key={id}
                                      title={label}
                                      onSelect={() => {
                                        close();
                                        openDrawer(a.id, id);
                                      }}
                                    />
                                  ))
                                }
                              </Menu>
                            </>
                          ) : a.case_id ? (
                            <Link href={`/cases/${a.case_id}`} className="rounded-lg px-3 py-1.5 text-label-s text-text-brand hover:bg-brand-primary-subtle">
                              View
                            </Link>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => openDrawer(a.id)}>
                              View
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-body-s text-text-secondary">
                      No alerts match.{" "}
                      <button
                        type="button"
                        className="text-text-brand hover:underline"
                        onClick={() => {
                          setFilter(NO_FILTER);
                          setSeverity("all");
                          setQuery("");
                          setMyRegions(false);
                        }}
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
