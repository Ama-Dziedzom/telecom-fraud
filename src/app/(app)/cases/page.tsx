"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Tabs } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { CaseBoard } from "@/components/cases/CaseBoard";
import { BulkNoteModal, NewCaseModal, ProspectModal, SaveViewModal } from "@/components/cases/CaseModals";
import { CaseTable, Pagination } from "@/components/cases/CaseTable";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch, isProblem } from "@/lib/api/client";
import { fraudTypeLabel, useApi, useMyCases, type CaseStatus, type CaseSummary, type Page, type PersonRef } from "@/lib/api/fd";
import { useNow } from "@/lib/time";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Scope = "mine" | "team" | "all";
/** The API calls the team queue `team_queue`. */
const VIEW: Record<Scope, string> = { mine: "mine", team: "team_queue", all: "all" };
type View = { id: string; name: string; owner: PersonRef; shared: boolean; default: boolean; filters: Filters };
/** Saved views can carry a single value (`period: "7d"`) as well as lists. */
type Filters = Record<string, string | string[] | undefined>;
const valuesOf = (v: Filters[string]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const STATUS_TABS: Array<{ id: "all" | CaseStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "investigating", label: "Investigating" },
  { id: "escalated", label: "Escalated" },
  { id: "sent_back", label: "Sent back" },
  { id: "pending_decision", label: "Pending decision" },
  { id: "closed", label: "Closed" },
];

const CHIP_LABEL: Record<string, string> = { severity: "Risk", region: "Region", status: "Status", fraud_type: "Type", period: "Period", sla: "SLA" };
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const chipValue = (key: string, v: string) =>
  key === "fraud_type" ? fraudTypeLabel(v) : key === "period" ? v.replace(/^(\d+)d$/, "Last $1 days") : titleCase(v.replace(/_/g, " "));
const PER_PAGE = 25;

function exportCsv(rows: CaseSummary[]) {
  const head = "case,subscriber,type,risk,status,assignee,alerts,sla_due_at";
  const body = rows.map((r) => [r.id, r.subscriber.msisdn, r.title, r.risk_score, r.status, r.assignee?.name ?? "", r.alerts, r.sla_due_at ?? ""].map((v) => `"${v}"`).join(","));
  const url = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "cases.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/** G1–G9 · Cases — list (mine / team queue / all) or the stage board. */
export default function CasesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const { mutate } = useSWRConfig();

  const [layout, setLayout] = useState<"list" | "board">(params.get("layout") === "board" ? "board" : "list");
  const [scope, setScope] = useState<Scope>((params.get("scope") as Scope) ?? "mine");
  const [status, setStatus] = useState<"all" | CaseStatus>(scope === "team" ? "new" : "all");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [viewId, setViewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "new" | "prospect" | "save_view" | "note">(params.get("new") === "1" ? "new" : null);

  const query = new URLSearchParams({ view: VIEW[scope] });
  if (q.trim()) query.set("q", q.trim());
  if (status !== "all") query.set("status", status);
  for (const [k, v] of Object.entries(filters)) if (valuesOf(v).length) query.set(k, valuesOf(v).join(","));
  // My cases and All cases are numbered pages; the team queue is one list.
  if (scope !== "team" && page > 1) query.set("page", String(page));
  // Demo hook for the error state (G9).
  if (params.get("demo")) query.set("demo", params.get("demo")!);
  const { data, error, isLoading } = useApi<Page<CaseSummary>>(layout === "list" ? `/cases?${query}` : null);
  // Counts, capacity and closed-this-month come with My cases (shared with the sidebar).
  const { data: mine } = useMyCases();
  const { data: views } = useApi<{ data: View[] }>("/views");

  const rows = data?.data ?? [];
  const counts = mine?.counts;
  const chips = Object.entries(filters).flatMap(([k, vs]) => valuesOf(vs).map((v) => [k, v] as const));
  const activeView = views?.data.find((v) => v.id === viewId);
  const team = scope === "team";
  const capacity = mine?.capacity;
  const room = capacity ? capacity.limit - capacity.open_cases : null;
  const pages = Math.max(1, Math.ceil((data?.total ?? rows.length) / PER_PAGE));
  const loadFailed = error && !(error instanceof ApiError && error.status === 404);

  const changeScope = (s: Scope) => {
    setScope(s);
    setStatus(s === "team" ? "new" : "all");
    setSelected(new Set());
    setPage(1);
  };

  const applyView = (v: View | null) => {
    setViewId(v?.id ?? null);
    setFilters(v?.filters ?? {});
    if (v) setScope("all");
    setStatus("all");
    setPage(1);
  };

  const pickUp = async (ids: string[]) => {
    setPicking(ids.length === 1 ? ids[0] : "bulk");
    try {
      // POST /cases/pick-up checks capacity first; 409 capacity_exceeded assigns nothing.
      const res = await apiFetch<{ assigned: string[]; room: number }>("POST", "/cases/pick-up", { case_ids: ids });
      setSelected(new Set());
      await mutate((key) => typeof key === "string" && key.startsWith("/cases"));
      toast({
        tone: "success",
        title: ids.length === 1 ? `${ids[0]} is yours` : `${res.assigned.length} cases are yours`,
        body: `Room for ${res.room} more.`,
        action: ids.length === 1 ? { label: "Open", onClick: () => router.push(`/cases/${ids[0]}`) } : undefined,
      });
    } catch (err) {
      if (isProblem(err, "capacity_exceeded")) {
        toast({ title: err.problem.title ?? "Pick-up limit reached", body: `${err.problem.detail} Pick fewer, or hand one over first.` });
      } else {
        toast({ title: "Couldn’t pick up", body: "Nothing was assigned. Try again." });
      }
    } finally {
      setPicking(null);
    }
  };

  const subtitle =
    layout === "board"
      ? "By stage · drag a card to move it, if your role allows."
      : counts
        ? `${counts.mine} assigned to you · ${counts.team_queue} waiting in the team queue`
        : " ";

  return (
    <>
      <AppHeader section="Work" title="Cases" />
      <PageBody>
        <PageHead
          title="Cases"
          subtitle={subtitle}
          actions={
            <>
              <Segmented
                label="Layout"
                value={layout}
                onChange={setLayout}
                options={[
                  { id: "board", label: "Board" },
                  { id: "list", label: "List" },
                ]}
              />
              {layout === "list" && (
                <Button variant="secondary" size="md" disabled={!rows.length} onClick={() => exportCsv(rows)} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
                  Export
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={() => setDialog("prospect")} iconLeft={<Icon name="app/icon-search-primary-18" size={18} />}>
                New prospect
              </Button>
              <Button size="md" onClick={() => setDialog("new")} iconLeft={<Icon name="app/icon-plus-white-18" size={18} />}>
                New case
              </Button>
            </>
          }
        />

        {layout === "board" ? (
          <CaseBoard />
        ) : (
          <>
            {selected.size > 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-brand-ink px-4 py-2.5" role="toolbar" aria-label="Bulk actions">
                <Checkbox label="Clear selection" hideLabel checked indeterminate={selected.size < rows.length} onChange={() => setSelected(new Set())} />
                <p className="text-label-m text-text-inverse">
                  {selected.size} {selected.size === 1 ? "case" : "cases"} selected
                  {room !== null && capacity && (
                    <span className="text-body-s text-[#c9c6e6]">
                      {" "}
                      · You have {capacity.open_cases} open, room for {room} more
                    </span>
                  )}
                </p>
                <span className="flex-1" />
                {team && (
                  <button
                    type="button"
                    onClick={() => pickUp(Array.from(selected))}
                    disabled={picking === "bulk"}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-label-s text-text-inverse hover:bg-white/15"
                  >
                    <Icon name="app/icon-user-white-16" size={16} />
                    Pick up ({selected.size})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDialog("note")}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-label-s text-text-inverse hover:bg-white/15"
                >
                  <Icon name="app/icon-message-white-16" size={16} />
                  Add a note to all
                </button>
                <button
                  type="button"
                  onClick={() => exportCsv(rows.filter((r) => selected.has(r.id)))}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-label-s text-text-inverse hover:bg-white/15"
                >
                  <Icon name="app/icon-download-white-18" size={16} />
                  Export ({selected.size})
                </button>
                <button type="button" aria-label="Clear selection" onClick={() => setSelected(new Set())} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10">
                  <Icon name="app/icon-x-lilac-18" size={18} />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  label="Whose cases"
                  value={scope}
                  onChange={changeScope}
                  options={[
                    { id: "mine", label: "My cases", count: counts?.mine },
                    { id: "team", label: "Team queue", count: counts?.team_queue },
                    { id: "all", label: "All cases", count: counts?.all },
                  ]}
                />
                <span className="flex-1" />
                <label className="flex h-10 w-[300px] items-center gap-2.5 rounded-lg border border-border-default bg-surface-base px-3.5 focus-within:border-border-focus focus-within:shadow-focus">
                  <Icon name="app/icon-search-18" size={18} />
                  <input
                    type="search"
                    aria-label="Search cases"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search case ID, MSISDN or subscriber"
                    className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
                  />
                </label>
                <Menu
                  label="Saved views"
                  width={300}
                  trigger={(t) => (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={t.toggle}
                      aria-expanded={t["aria-expanded"]}
                      aria-haspopup="menu"
                      iconLeft={<Icon name="app/icon-sliders-18" size={18} />}
                      iconRight={<Icon name="app/icon-chevron-down-16" size={16} />}
                    >
                      View: {activeView?.name ?? "Default"}
                    </Button>
                  )}
                >
                  {(close) => (
                    <>
                      {(["me", "team"] as const).map((owner) => (
                        <div key={owner} className="flex flex-col gap-0.5">
                          <MenuLabel>{owner === "me" ? "My views" : "Team views"}</MenuLabel>
                          {views?.data
                            .filter((v) => v.shared === (owner === "team"))
                            .map((v) => (
                              <MenuItem
                                key={v.id}
                                icon={v.id === viewId ? "app/icon-check-secondary-18" : owner === "me" ? "app/icon-sliders-18" : "app/icon-users-secondary-18"}
                                title={v.name}
                                onSelect={() => {
                                  close();
                                  applyView(v.id === viewId ? null : v);
                                }}
                              />
                            ))}
                        </div>
                      ))}
                      <MenuDivider />
                      <MenuItem
                        icon="app/icon-plus-secondary-18"
                        title="Save current filters as a view"
                        onSelect={() => {
                          close();
                          setDialog("save_view");
                        }}
                      />
                    </>
                  )}
                </Menu>
                <Menu
                  label="Filters"
                  width={280}
                  trigger={(t) => (
                    <Button variant="secondary" size="md" onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu" iconLeft={<Icon name="app/icon-filter-18" size={18} />}>
                      Filters{chips.length ? ` · ${chips.length}` : ""}
                    </Button>
                  )}
                >
                  {() => (
                    <div className="flex flex-col gap-3 p-2">
                      {(
                        [
                          ["severity", ["critical", "high", "medium", "low"]],
                          ["region", ["Greater Accra", "Ashanti", "Central", "Western"]],
                        ] as const
                      ).map(([key, options]) => (
                        <fieldset key={key} className="flex flex-col gap-2">
                          <legend className="mb-1 text-overline text-text-tertiary uppercase">{CHIP_LABEL[key]}</legend>
                          {options.map((o) => (
                            <Checkbox
                              key={o}
                              label={titleCase(o)}
                              checked={valuesOf(filters[key]).includes(o)}
                              onChange={(e) => {
                                setPage(1);
                                setFilters((f) => ({
                                  ...f,
                                  [key]: e.target.checked ? [...valuesOf(f[key]), o] : valuesOf(f[key]).filter((x) => x !== o),
                                }));
                              }}
                            />
                          ))}
                        </fieldset>
                      ))}
                    </div>
                  )}
                </Menu>
              </div>
            )}

            {chips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                Filtered by
                {chips.map(([k, v]) => (
                  <span key={k + v} className="flex items-center gap-1.5 rounded-full bg-brand-primary-subtle px-2.5 py-1 text-label-s text-text-brand">
                    {CHIP_LABEL[k] ?? titleCase(k)}: {chipValue(k, v)}
                    <button
                      type="button"
                      aria-label={`Remove ${CHIP_LABEL[k]} ${v}`}
                      onClick={() => {
                        setViewId(null);
                        setFilters((f) => ({ ...f, [k]: valuesOf(f[k]).filter((x) => x !== v) }));
                      }}
                      className="flex rounded"
                    >
                      <Icon name="app/icon-x-brand-14" size={12} />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={() => applyView(null)} className="rounded px-1 text-label-s text-text-brand hover:underline">
                  Clear all
                </button>
              </div>
            ) : (
              <Tabs
                label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v as typeof status);
                  setSelected(new Set());
                }}
                tabs={STATUS_TABS.map((t) => ({
                  id: t.id,
                  label: t.label,
                  count:
                    t.id === "all"
                      ? Object.entries(counts?.by_status ?? {}).reduce((s, [k, n]) => (k === "closed" ? s : s + (n ?? 0)), 0)
                      : t.id === "closed"
                        ? (counts?.by_status.closed ?? mine?.closed_this_month)
                        : counts?.by_status[t.id],
                }))}
              />
            )}

            {loadFailed ? (
              <EmptyState
                icon="icon-alert-triangle-critical-24"
                tone="critical"
                title="We couldn’t load your cases"
                className="min-h-[300px]"
                actions={
                  <>
                    <Button size="md" onClick={() => mutate(`/cases?${query}`)} iconLeft={<Icon name="app/icon-refresh-white-18" size={18} />}>
                      Try again
                    </Button>
                    <ButtonLink href="/status" variant="secondary" size="md" iconLeft={<Icon name="app/icon-activity-secondary-18" size={18} />}>
                      System status
                    </ButtonLink>
                  </>
                }
              >
                The case service didn’t respond. Nothing is lost and your filters are kept. Try again, or quote reference{" "}
                {error instanceof ApiError ? (error.problem.request_id ?? "CASE-503") : "CASE-503"} to support.
              </EmptyState>
            ) : !isLoading && rows.length === 0 ? (
              q.trim() ? (
                <EmptyState
                  icon="app/icon-search-brand-20"
                  tone="brand"
                  title={`No cases for “${q.trim()}”`}
                  className="min-h-[300px]"
                  actions={
                    <>
                      <ButtonLink href={`/subscribers?q=${encodeURIComponent(q.trim())}`} variant="secondary" size="md" iconLeft={<Icon name="app/icon-user-16" size={16} />}>
                        Look up subscriber
                      </ButtonLink>
                      <Button size="md" onClick={() => setDialog("new")} iconLeft={<Icon name="app/icon-plus-white-18" size={18} />}>
                        Open a case for this number
                      </Button>
                    </>
                  }
                >
                  Try the last 4 digits, or check closed cases. If this subscriber has never had a case, you can look them up or open one.
                </EmptyState>
              ) : (
                <EmptyState icon="app/icon-check-circle-success-22" tone="success" title="Nothing here" className="min-h-[300px]">
                  {team ? "The team queue is empty. New cases land here when alerts are promoted." : "No cases match this tab."}
                </EmptyState>
              )
            ) : (
              <>
                <CaseTable rows={rows} loading={isLoading} team={team} now={now} selected={selected} onSelect={setSelected} onPickUp={pickUp} picking={picking} />
                {!isLoading && (
                  <Pagination
                    summary={
                      team
                        ? `Showing ${rows.length} of ${counts?.team_queue ?? rows.length} unassigned`
                        : chips.length || q
                          ? `Showing ${rows.length} of ${data?.total ?? rows.length} matching`
                          : `Showing ${rows.length} of ${data?.total ?? rows.length} open · ${mine?.closed_this_month ?? 0} closed this month`
                    }
                    page={data?.page ?? page}
                    pages={pages}
                    onPage={setPage}
                  />
                )}
              </>
            )}
          </>
        )}
      </PageBody>

      {dialog === "new" && <NewCaseModal initialNumber={q.replace(/[^\d+ ]/g, "")} onClose={() => setDialog(null)} />}
      {dialog === "prospect" && <ProspectModal onClose={() => setDialog(null)} />}
      {dialog === "save_view" && (
        <SaveViewModal
          summary={[...chips.map(([k, v]) => `${CHIP_LABEL[k] ?? titleCase(k)} ${v}`), status !== "all" ? status.replace(/_/g, " ") : "", q].filter(Boolean).join(" · ")}
          filters={{ ...filters, ...(status !== "all" ? { status: [status] } : {}), q: q || undefined }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "note" && (
        <BulkNoteModal
          caseIds={Array.from(selected)}
          onDone={() => setSelected(new Set())}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

