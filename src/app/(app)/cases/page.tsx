"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Tabs } from "@/components/app/Card";
import { riskTone } from "@/components/app/indicators";
import { CaseBoard } from "@/components/cases/CaseBoard";
import { BulkNoteModal, NewCaseModal, ProspectModal, SaveViewModal } from "@/components/cases/CaseModals";
import { CaseTable, localMsisdn, type CaseSort } from "@/components/cases/CaseTable";
import { WatchModal } from "@/components/lookup/LookupModals";
import { BarDivider, BulkAction, BulkBar, FilterButton, Pagination, SegmentChips, TableState, ToolbarSearch } from "@/components/cases/Table";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch, isProblem } from "@/lib/api/client";
import { useApi, useMyCases, type CaseStatus, type CaseSummary, type Page, type PersonRef, type Severity } from "@/lib/api/fd";
import { formatSpan, useNow } from "@/lib/time";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Scope = "mine" | "team" | "all";
/** The API calls the team queue `team_queue`. */
const VIEW: Record<Scope, string> = {
  mine: "mine",
  team: "team_queue",
  all: "all",
};
type View = {
  id: string;
  name: string;
  owner: PersonRef;
  shared: boolean;
  default: boolean;
  filters: Filters;
};
/** Saved views can carry a single value (`period: "7d"`) as well as lists. */
type Filters = Record<string, string | string[] | undefined>;
const valuesOf = (v: Filters[string]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Segment chips per scope: status (My cases), risk (Team queue), open/closed (All cases). */
const STATUS_SEGMENTS: Array<{ id: "all" | CaseStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "investigating", label: "Investigating" },
  { id: "escalated", label: "Escalated" },
  { id: "sent_back", label: "Sent back" },
  { id: "reopened", label: "Reopened" },
  { id: "pending_decision", label: "Pending decision" },
  { id: "closed", label: "Closed" },
];
const RISK_SEGMENTS: Array<{ id: "all" | Severity; label: string }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

/** What the filter panel offers (Foundations · Filter panel 1335:188188). */
const FILTER_GROUPS = [
  ["severity", "Risk", ["critical", "high", "medium", "low"]],
  ["region", "Region", ["Greater Accra", "Ashanti", "Central", "Western"]],
] as const;
const FILTER_LABEL: Record<string, string> = {
  severity: "Risk",
  region: "Region",
  status: "Status",
  fraud_type: "Type",
  period: "Period",
  sla: "SLA",
};
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PER_PAGE = 25;

function exportCsv(rows: CaseSummary[]) {
  const head = "case,subscriber,type,risk,status,assignee,alerts,sla_due_at";
  const body = rows.map((r) => [r.id, r.subscriber.msisdn, r.title, r.risk_score, r.status, r.assignee?.name ?? "", r.alerts, r.sla_due_at ?? ""].map((v) => `"${v}"`).join(","));
  const url = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: "cases.csv",
  });
  a.click();
  URL.revokeObjectURL(url);
}

/** “1 h”, “50 min”. */
const waitText = (ms: number) =>
  formatSpan(ms)
    .replace(/^(\d+)m$/, "$1 min")
    .replace(/^(\d+)h 00m$/, "$1 h");

/** G1–G9 · Cases — My cases / Team queue / All cases as a table, or the stage board (G2). */
export default function CasesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const { mutate } = useSWRConfig();

  const [board, setBoard] = useState(params.get("layout") === "board");
  const [scope, setScope] = useState<Scope>((params.get("scope") as Scope) ?? "mine");
  const [segment, setSegment] = useState<string>("all");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [viewId, setViewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CaseSort>("risk");
  const [picking, setPicking] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "new" | "prospect" | "save_view">(params.get("new") === "1" ? "new" : null);
  const [noteFor, setNoteFor] = useState<string[] | null>(null);
  const [watchFor, setWatchFor] = useState<CaseSummary | null>(null);

  const team = scope === "team";
  const query = new URLSearchParams({ view: VIEW[scope] });
  if (q.trim()) query.set("q", q.trim());
  // My cases filters by status on the server; the team queue (one list) and All cases’ open/closed split are filtered here.
  if (scope === "mine" && segment !== "all") query.set("status", segment);
  for (const [k, v] of Object.entries(filters)) if (valuesOf(v).length) query.set(k, valuesOf(v).join(","));
  if (!team && page > 1) query.set("page", String(page));
  // Demo hook for the error state (G9).
  if (params.get("demo")) query.set("demo", params.get("demo")!);
  const casesKey = board ? null : `/cases?${query}`;
  const { data, error, isLoading } = useApi<Page<CaseSummary>>(casesKey);
  // Counts, capacity and closed-this-month come with My cases (shared with the sidebar).
  const { data: mine } = useMyCases();
  const { data: views } = useApi<{ data: View[] }>("/views");

  const fetched = data?.data ?? [];
  const counts = mine?.counts;
  const capacity = mine?.capacity;
  const room = capacity ? capacity.limit - capacity.open_cases : null;
  const filterCount = Object.values(filters).reduce((n, v) => n + valuesOf(v).length, 0);
  const activeView = views?.data.find((v) => v.id === viewId);
  const loadFailed = !!error && !(error instanceof ApiError && error.status === 404);
  const loading = isLoading && !data;

  // Segment counts and the rows the current segment shows.
  const segmentOf = (c: CaseSummary) => (team ? riskTone(c.risk_score) : scope === "all" ? (c.status === "closed" ? "closed" : "open") : c.status);
  const tally = (id: string) => (id === "all" ? fetched.length : fetched.filter((c) => segmentOf(c) === id).length);
  const visible = (scope === "mine" || segment === "all" ? fetched : fetched.filter((c) => segmentOf(c) === segment))
    .slice()
    .sort((a, b) => (sort === "risk" ? b.risk_score - a.risk_score : Date.parse(a.sla_due_at ?? "9999") - Date.parse(b.sla_due_at ?? "9999")));
  const total = data?.total ?? fetched.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const oldest = fetched.reduce((t, c) => Math.min(t, Date.parse(c.waiting_since)), now);

  const resetSelection = () => {
    setSelected(new Set());
    setPage(1);
  };
  const changeScope = (s: Scope) => {
    setScope(s);
    setSegment("all");
    resetSelection();
  };
  const applyView = (v: View | null) => {
    setViewId(v?.id ?? null);
    const { status, ...rest } = v?.filters ?? {};
    if (v) setScope("all");
    // Saved views keep open/closed as a segment; any other status stays a filter.
    const st = valuesOf(status);
    const split = st.length === 1 && (st[0] === "open" || st[0] === "closed");
    setSegment(split ? st[0] : "all");
    setFilters(split || !st.length ? rest : { ...rest, status: st });
    resetSelection();
  };

  // Saved views in the sidebar link here as ?saved=<id> (G5c).
  const saved = params.get("saved");
  const savedView = saved ? views?.data.find((x) => x.id === saved) : undefined;
  const [appliedSaved, setAppliedSaved] = useState<string | null>(null);
  if (savedView && appliedSaved !== savedView.id) {
    setAppliedSaved(savedView.id);
    applyView(savedView);
  }

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
        toast({
          title: err.problem.title ?? "Pick-up limit reached",
          body: `${err.problem.detail} Pick fewer, or hand one over first.`,
        });
      } else {
        toast({
          title: "Couldn’t pick up",
          body: "Nothing was assigned. Try again.",
        });
      }
    } finally {
      setPicking(null);
    }
  };

  const filtered = filterCount > 0 || !!q.trim();
  const subtitle = board
    ? "By stage · drag a card to move it, if your role allows"
    : loading
      ? "Loading your cases"
      : team
        ? `${fetched.length} unassigned${fetched.length ? ` · oldest waiting ${waitText(now - oldest)}` : ""}`
        : scope === "all"
          ? [
              `${counts?.all ?? total} cases`,
              loadFailed
                ? null
                : activeView && visible.length
                  ? `${visible.length} in this view`
                  : filtered || segment !== "all"
                    ? visible.length
                      ? `${visible.length} match your filters`
                      : "none match your filters"
                    : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : counts
            ? `${counts.mine} assigned to you · ${counts.team_queue} waiting in the team queue`
            : " ";

  const segments =
    scope === "mine"
      ? STATUS_SEGMENTS.filter((s) => s.id !== "sent_back" || (counts?.by_status.sent_back ?? 0) > 0).map((s) => ({
          id: s.id as string,
          label: s.label,
          count: loading
            ? undefined
            : s.id === "all"
              ? Object.entries(counts?.by_status ?? {}).reduce((n, [k, c]) => (k === "closed" ? n : n + (c ?? 0)), 0)
              : s.id === "closed"
                ? (counts?.by_status.closed ?? mine?.closed_this_month)
                : (counts?.by_status[s.id] ?? 0),
        }))
      : team
        ? RISK_SEGMENTS.map((s) => ({
            id: s.id as string,
            label: s.label,
            count: loading ? undefined : tally(s.id),
          }))
        : [
            {
              id: "all",
              label: "All",
              count: loading || loadFailed ? undefined : tally("all"),
            },
            {
              id: "open",
              label: "Open",
              count: loading || loadFailed ? undefined : tally("open"),
            },
            {
              id: "closed",
              label: "Closed",
              count: loading || loadFailed ? undefined : tally("closed"),
            },
          ];

  const clearFilters = () => {
    applyView(null);
    setQ("");
    if (saved) router.replace("/cases");
  };

  const footer =
    loading || loadFailed || !visible.length ? null : (
      <Pagination
        summary={
          team
            ? `Showing 1-${visible.length} of ${counts?.team_queue ?? visible.length}`
            : scope === "mine" && !filtered && segment === "all"
              ? `${visible.length} open · ${mine?.closed_this_month ?? 0} closed this month`
              : pages > 1
                ? `Showing ${(page - 1) * PER_PAGE + 1}-${(page - 1) * PER_PAGE + visible.length} of ${total}`
                : `${visible.length} matching`
        }
        page={data?.page ?? page}
        pages={pages}
        onPage={setPage}
      />
    );

  return (
    <>
      <AppHeader section="Work" title="Cases" />
      <PageBody>
        <PageHead
          title="Cases"
          subtitle={subtitle}
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => setDialog("prospect")}>
                New prospect
              </Button>
              <Button size="md" onClick={() => setDialog("new")}>
                New case
              </Button>
            </>
          }
        />

        <div className="flex flex-col">
          <Tabs
            label="Whose cases"
            surface="canvas"
            value={scope}
            onChange={changeScope}
            tabs={[
              { id: "mine", label: "My cases", count: counts?.mine },
              { id: "team", label: "Team queue", count: counts?.team_queue },
              { id: "all", label: "All cases", count: counts?.all },
            ]}
          />

          {selected.size > 0 && !board ? (
            <div className="py-2">
              <BulkBar
                count={selected.size}
                noun={["case", "cases"]}
                detail={capacity && room !== null ? `You have ${capacity.open_cases} open, room for ${room} more` : undefined}
                onClear={() => setSelected(new Set())}
              >
                {team && (
                  <BulkAction loading={picking === "bulk"} onClick={() => pickUp(Array.from(selected))}>
                    Pick up ({selected.size})
                  </BulkAction>
                )}
                <BulkAction onClick={() => setNoteFor(Array.from(selected))}>Add a note</BulkAction>
                <BulkAction onClick={() => exportCsv(visible.filter((r) => selected.has(r.id)))}>Export ({selected.size})</BulkAction>
              </BulkBar>
            </div>
          ) : (
            <div className="flex min-h-16 flex-wrap items-center gap-2 py-4">
              <ToolbarSearch label="Search cases" value={q} onChange={(v) => (setQ(v), resetSelection())} placeholder="Search case ID, MSISDN or subscriber" />
              {scope === "all" && !board && (
                <Menu
                  label="Saved views"
                  width={240}
                  align="start"
                  trigger={(t) => (
                    <FilterButton onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu">
                      View: {activeView?.name.replace(/, /g, " · ") ?? (filterCount ? "Unsaved filters" : "Default")}
                    </FilterButton>
                  )}
                >
                  {(close) => (
                    <>
                      {(["me", "team"] as const).map((owner) => {
                        const list = views?.data.filter((v) => v.shared === (owner === "team")) ?? [];
                        return list.length ? (
                          <div key={owner} className="flex flex-col gap-0.5">
                            <MenuLabel>{owner === "me" ? "My views" : "Team views"}</MenuLabel>
                            {list.map((v) => (
                              <MenuItem
                                key={v.id}
                                icon={v.id === viewId ? "app/icon-check-secondary-18" : undefined}
                                title={v.name.replace(/, /g, " · ")}
                                onSelect={() => {
                                  close();
                                  router.replace(v.id === viewId ? "/cases?scope=all" : `/cases?saved=${v.id}`);
                                  applyView(v.id === viewId ? null : v);
                                }}
                              />
                            ))}
                          </div>
                        ) : null;
                      })}
                      <MenuDivider />
                      <MenuItem
                        title="Save current filters as a view"
                        disabled={!filterCount && segment === "all"}
                        onSelect={() => {
                          close();
                          setDialog("save_view");
                        }}
                      />
                    </>
                  )}
                </Menu>
              )}
              <Menu
                label="Filters"
                width={260}
                align="start"
                trigger={(t) => (
                  <FilterButton icon="filter" active={filterCount > 0} count={filterCount || undefined} onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu">
                    Filters
                  </FilterButton>
                )}
              >
                {(close) => (
                  <div className="flex flex-col gap-4 p-2.5">
                    {FILTER_GROUPS.map(([key, title, options]) => (
                      <fieldset key={key} className="flex flex-col gap-2">
                        <legend className="mb-1.5 text-caption font-medium text-text-secondary">{title}</legend>
                        {options.map((o) => (
                          <Checkbox
                            key={o}
                            label={titleCase(o)}
                            className="text-body-s"
                            checked={valuesOf(filters[key]).includes(o)}
                            onChange={(e) => {
                              setViewId(null);
                              resetSelection();
                              setFilters((f) => ({
                                ...f,
                                [key]: e.target.checked ? [...valuesOf(f[key]), o] : valuesOf(f[key]).filter((x) => x !== o),
                              }));
                            }}
                          />
                        ))}
                      </fieldset>
                    ))}
                    {Object.entries(filters)
                      .filter(([k]) => !FILTER_GROUPS.some(([g]) => g === k))
                      .flatMap(([k, v]) => valuesOf(v).map((x) => `${FILTER_LABEL[k] ?? titleCase(k)}: ${x.replace(/_/g, " ")}`))
                      .map((t) => (
                        <p key={t} className="text-caption text-text-secondary">
                          {t}
                        </p>
                      ))}
                    <div className="flex justify-between border-t border-border-default pt-3">
                      <Button variant="ghost" size="sm" disabled={!filterCount} onClick={() => (clearFilters(), close())}>
                        Clear
                      </Button>
                      <Button variant="secondary" size="sm" onClick={close}>
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </Menu>
              {!board && (
                <>
                  <BarDivider />
                  <SegmentChips
                    label={team ? "Risk" : "Status"}
                    value={segment}
                    onChange={(s) => {
                      setSegment(s);
                      resetSelection();
                    }}
                    options={segments}
                  />
                </>
              )}
              <span className="flex-1" />
              <Toggle
                label="Board view"
                className="text-body-s"
                checked={board}
                onChange={(e) => {
                  setBoard(e.target.checked);
                  setSelected(new Set());
                }}
              />
            </div>
          )}

          {board ? (
            <CaseBoard q={q} />
          ) : (
            <CaseTable
              rows={visible}
              loading={loading}
              team={team}
              scope={scope}
              now={now}
              selected={selected}
              onSelect={setSelected}
              onPickUp={pickUp}
              onNote={setNoteFor}
              onWatch={setWatchFor}
              sort={sort}
              onSort={setSort}
              footer={footer}
              state={
                loadFailed
                  ? (cols) => (
                      <TableState
                        colSpan={cols}
                        icon="app/icon-alert-circle-tertiary-20"
                        title="Couldn’t load cases"
                        action={
                          <Button variant="secondary" size="sm" onClick={() => casesKey && mutate(casesKey)} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
                            Retry
                          </Button>
                        }
                      >
                        The case service didn’t respond. Your filters are kept.
                        {error instanceof ApiError && error.problem.request_id ? ` Reference ${error.problem.request_id}.` : ""}
                      </TableState>
                    )
                  : !visible.length
                    ? (cols) =>
                        q.trim() ? (
                          <TableState
                            colSpan={cols}
                            icon="app/icon-search-18"
                            title={`No cases for “${q.trim()}”`}
                            action={
                              <Button variant="secondary" size="sm" onClick={() => setDialog("new")}>
                                Open a case for this number
                              </Button>
                            }
                          >
                            Try the last 4 digits, or check closed cases.
                          </TableState>
                        ) : filterCount || segment !== "all" ? (
                          <TableState
                            colSpan={cols}
                            icon="app/icon-search-18"
                            title="No cases match these filters"
                            action={
                              <Button variant="secondary" size="sm" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            }
                          >
                            Try widening the risk or region, or clear the filters.
                          </TableState>
                        ) : (
                          <TableState colSpan={cols} icon="app/icon-check-circle-tertiary-18" title="Nothing here">
                            {team ? "The team queue is empty. New cases land here when alerts are promoted." : "No cases assigned to you right now."}
                          </TableState>
                        )
                    : undefined
              }
            />
          )}
        </div>
      </PageBody>

      {dialog === "new" && <NewCaseModal initialNumber={q.replace(/[^\d+ ]/g, "")} onClose={() => setDialog(null)} />}
      {dialog === "prospect" && <ProspectModal onClose={() => setDialog(null)} />}
      {dialog === "save_view" && (
        <SaveViewModal
          summary={[...Object.entries(filters).map(([k, v]) => valuesOf(v).map(titleCase).join(" and ") || FILTER_LABEL[k]), segment !== "all" ? segment.replace(/_/g, " ") : ""]
            .filter(Boolean)
            .join(" · ")}
          filters={{
            ...filters,
            ...(segment !== "all" ? { status: [segment] } : {}),
            q: q || undefined,
          }}
          onSaved={(v) => router.replace(`/cases?saved=${v.id}`)}
          onClose={() => setDialog(null)}
        />
      )}
      {watchFor && (
        <WatchModal
          title={`Watch ${localMsisdn(watchFor.subscriber.msisdn)}`}
          subtitle={`${watchFor.subscriber.name} · ${watchFor.id}`}
          entityIds={[watchFor.subscriber.subscriber_id]}
          caseId={watchFor.id}
          onClose={() => setWatchFor(null)}
        />
      )}
      {noteFor && <BulkNoteModal caseIds={noteFor} onDone={() => setSelected(new Set())} onClose={() => setNoteFor(null)} />}
    </>
  );
}
