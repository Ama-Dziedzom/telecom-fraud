"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton, Tabs } from "@/components/app/Card";
import { InlineState } from "@/components/reports/Insights";
import { formatLabel, NewReportModal, nextRunLabel, scheduleLabel, ShareReportModal, sharedLabel, templateLabel, TEMPLATES, type Report } from "@/components/reports/ReportModals";
import { DataTable, Td, Th, THead, Tr, TwoLine } from "@/components/reports/Table";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type Page } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen, useNow } from "@/lib/time";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";

type List = Page<Report> & { counts: { all: number; scheduled: number; shared: number } };
type Tab = "all" | "scheduled" | "shared";

/** Why a report failed, in the app’s words, and the format to retry in. */
function failureCopy(r: Report) {
  if (r.error?.code === "export_too_large" && r.format !== "csv") {
    return { detail: `It’s over the size limit for ${formatLabel(r.format)}. Retry as CSV (no limit) or narrow the date range.`, retry: "csv" as const };
  }
  if (r.error?.code === "export_too_large") return { detail: "It’s over the size limit. Narrow the date range and try again.", retry: null };
  return { detail: "Something went wrong while it was being generated. Try again.", retry: r.format };
}

/** H6/H10/H11 · Status pill for one report. */
function StatusPill({ r }: { r: Report }) {
  if (r.status === "building") return <Badge label={`Generating · ${r.progress_pct ?? 0}%`} tone="info" />;
  if (r.status === "failed") return <Badge label="Failed" tone="critical" />;
  return <Badge label="Ready" tone="success" />;
}

/** Ghost 32 icon button that opens a row’s menu. */
function RowMenu({ name, children }: { name: string; children: (close: () => void) => ReactNode }) {
  return (
    <Menu
      label={`Actions for ${name}`}
      width={200}
      compact
      trigger={(t) => (
        <button
          type="button"
          aria-label={`Actions for ${name}`}
          onClick={t.toggle}
          aria-expanded={t["aria-expanded"]}
          aria-haspopup="menu"
          className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken"
        >
          <Icon name="app/icon-more-16" size={16} />
        </button>
      )}
    >
      {children}
    </Menu>
  );
}

/** H6/H10/H11/H13/H15 · Reports — templates, the library, scheduled reports and failures. */
export default function ReportsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const { mutate } = useSWRConfig();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<null | { template?: string; schedule?: boolean }>(null);
  const [sharing, setSharing] = useState<Report | null>(null);
  const qs = new URLSearchParams({ tab });
  if (q.trim()) qs.set("q", q.trim());
  if (params.get("demo")) qs.set("demo", params.get("demo")!);
  const key = `/reports?${qs}`;
  const { data } = useApi<List>(key, { refreshInterval: (d) => (d?.data.some((r) => r.status === "building") ? 1500 : 0) });
  const failed = data?.data.find((r) => r.status === "failed");
  const failure = failed && failureCopy(failed);
  const building = data?.data.some((r) => r.status === "building");
  const empty = data && data.counts.all === 0 && !q;
  const refresh = () => mutate((k) => typeof k === "string" && k.startsWith("/reports"));

  // H12 · When a report we watched building turns ready, say so.
  const watching = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    for (const r of data.data) {
      if (r.status === "building") watching.current.add(r.id);
      else if (watching.current.delete(r.id) && r.status === "ready") {
        toast({ tone: "success", title: "Your report is ready", body: `${r.name} · ${formatLabel(r.format)}`, action: { label: "Open", onClick: () => router.push(`/reports/${r.id}`) } });
      }
    }
  }, [data, router, toast]);

  const download = async (r: Report) => {
    // PDFs are laid out in their own tab; Download PDF there saves the file.
    if (r.format === "pdf") return void window.open(`/print/reports/${r.id}`, "_blank");
    await apiFetch<{ url: string }>("GET", `/reports/${r.id}/download`);
    toast({ tone: "success", title: `Downloading ${r.name}`, body: `${formatLabel(r.format)} · link valid for 24 hours.` });
  };
  const retry = async (r: Report, format?: string) => {
    await apiFetch("POST", `/reports/${r.id}/retry`, { format: format ?? r.format });
    await refresh();
  };
  const scheduleAction = async (r: Report, action: "run" | "pause" | "resume" | "delete") => {
    if (action === "run") await apiFetch("POST", `/reports/${r.id}/run`);
    else if (action === "delete") await apiFetch("DELETE", `/reports/${r.id}`);
    else await apiFetch("PATCH", `/reports/${r.id}/schedule`, { paused: action === "pause" });
    await refresh();
    toast({ tone: "success", title: action === "run" ? `Running “${r.name}”` : action === "delete" ? `Deleted “${r.name}”` : action === "pause" ? `Paused “${r.name}”` : `Resumed “${r.name}”` });
  };

  const scheduled = tab === "scheduled";
  const header = scheduled ? (
    <THead>
      <Th>Report</Th>
      <Th className="w-[150px]">Schedule</Th>
      <Th className="w-[160px]">Next run</Th>
      <Th className="w-[150px]">Sent to</Th>
      <Th className="w-[120px]">Status</Th>
      <Th className="w-14">
        <span className="sr-only">Actions</span>
      </Th>
    </THead>
  ) : (
    <THead>
      <Th>Report</Th>
      <Th className="w-[150px]">Schedule</Th>
      <Th className="w-[170px]">Status</Th>
      <Th className="w-[140px]">Last run</Th>
      <Th className="w-[100px]">Format</Th>
      <Th className="w-[170px]">Shared with</Th>
      <Th className="w-14">
        <span className="sr-only">Actions</span>
      </Th>
    </THead>
  );

  return (
    <>
      <AppHeader section="Insights" title="Reports" />
      <PageBody className="flex flex-1 flex-col gap-4 px-8 pt-6 pb-8">
        <div className="flex flex-col gap-5">
          <PageHead
            title="Reports"
            subtitle="Generate a report once or put it on a schedule. Finished reports are kept for 90 days."
            actions={
              <Button size="md" onClick={() => setDialog({})}>
                New report
              </Button>
            }
          />
          <Tabs
            label="Reports"
            surface="canvas"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "all", label: "All", count: data?.counts.all },
              { id: "scheduled", label: "Scheduled", count: data?.counts.scheduled },
              { id: "shared", label: "Shared with me", count: data?.counts.shared },
            ]}
          />
        </div>

        {failed && failure && (
          <Banner
            tone="error"
            title={`“${failed.name}” couldn’t be generated`}
            action={
              failure.retry ? (
                <button type="button" onClick={() => retry(failed, failure.retry!)} className="shrink-0 rounded text-label-s text-text-brand hover:underline">
                  Retry as {formatLabel(failure.retry)}
                </button>
              ) : (
                <button type="button" onClick={() => setDialog({ template: failed.template })} className="shrink-0 rounded text-label-s text-text-brand hover:underline">
                  Narrow the range
                </button>
              )
            }
          >
            {failure.detail}
          </Banner>
        )}

        {tab === "all" && !failed && !building && (
          <>
            <p className="text-label-s text-text-primary">Start from a template</p>
            <div className="grid grid-cols-4 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDialog({ template: t.id })}
                  className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border-default bg-surface-base p-4 text-left hover:border-border-strong"
                >
                  <span className="truncate text-label-s text-text-primary">{t.label}</span>
                  <span className="truncate text-caption text-text-secondary">{t.detail}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {!empty && (
          <div className="flex h-16 items-center py-4">
            <label className="flex h-8 w-[280px] items-center gap-2 rounded-lg border border-border-strong bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-focus">
              <Icon name="app/icon-search-tertiary-16" size={16} />
              <input
                type="search"
                aria-label="Search reports"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search reports"
                className="min-w-0 flex-1 bg-transparent text-body-s outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
              />
            </label>
          </div>
        )}

        {!data ? (
          <Skeleton className="h-[300px] w-full rounded-lg" />
        ) : empty || !data.data.length ? (
          <DataTable>
            {header}
            <tbody>
              <tr>
                <td colSpan={scheduled ? 6 : 7} className="py-14">
                  {empty ? (
                    <InlineState
                      icon="app/icon-inbox-tertiary-20"
                      title="No reports yet"
                      actions={
                        <Button variant="secondary" size="md" onClick={() => setDialog({})}>
                          New report
                        </Button>
                      }
                    >
                      Start from a template above, or build your own.
                    </InlineState>
                  ) : (
                    <InlineState
                      icon="app/icon-search-tertiary-16"
                      title={q ? `No reports match “${q.trim()}”` : scheduled ? "Nothing scheduled" : "Nothing shared with you yet"}
                      actions={
                        q ? (
                          <Button variant="secondary" size="md" onClick={() => setQ("")}>
                            Clear search
                          </Button>
                        ) : undefined
                      }
                    >
                      {q ? "Try another name, or clear the search." : scheduled ? "Turn on “Repeat on a schedule” when you create a report." : "Reports people share with you show up here."}
                    </InlineState>
                  )}
                </td>
              </tr>
            </tbody>
          </DataTable>
        ) : (
          <DataTable footer={scheduled ? `${data.total ?? data.data.length} scheduled` : `${data.total ?? data.data.length} reports`}>
            {header}
            <tbody>
              {data.data.map((r) => (
                <Tr
                  key={r.id}
                  onClick={() => r.status === "ready" && router.push(`/reports/${r.id}`)}
                  className={cn(r.status === "ready" && "cursor-pointer hover:bg-surface-sunken")}
                >
                  <Td className="h-16">
                    <TwoLine title={r.name} sub={templateLabel(r.template)} />
                  </Td>
                  <Td>{scheduleLabel(r.schedule)}</Td>
                  {scheduled ? (
                    <>
                      <Td>{r.schedule?.paused || !r.next_run_at ? "—" : nextRunLabel(r.next_run_at)}</Td>
                      <Td>{sharedLabel(r.shared_with)}</Td>
                      <Td>{r.schedule?.paused ? <Badge label="Paused" tone="neutral" /> : <Badge label="Active" tone="success" />}</Td>
                    </>
                  ) : (
                    <>
                      <Td>
                        <StatusPill r={r} />
                      </Td>
                      <Td>{r.status === "building" ? `Started ${formatClock(r.last_run_at)}` : formatWhen(r.last_run_at, now, { withTime: true })}</Td>
                      <Td>
                        <Badge label={formatLabel(r.format)} tone="neutral" />
                      </Td>
                      <Td>{sharedLabel(r.shared_with)}</Td>
                    </>
                  )}
                  <Td clip={false} className="px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowMenu name={r.name}>
                      {(close) =>
                        scheduled ? (
                          <>
                            <MenuItem icon="app/icon-refresh-16" title="Run now" onSelect={() => (close(), scheduleAction(r, "run"))} />
                            <MenuItem icon="app/icon-file-secondary-16" title="Edit schedule" onSelect={() => (close(), setDialog({ template: r.template, schedule: true }))} />
                            <MenuItem
                              icon="app/icon-clock-secondary-16"
                              title={r.schedule?.paused ? "Resume" : "Pause"}
                              onSelect={() => (close(), scheduleAction(r, r.schedule?.paused ? "resume" : "pause"))}
                            />
                            <MenuDivider />
                            <MenuItem title="Delete schedule" tone="critical" onSelect={() => (close(), scheduleAction(r, "delete"))} />
                          </>
                        ) : r.status === "failed" ? (
                          <>
                            {failureCopy(r).retry && (
                              <MenuItem icon="app/icon-refresh-16" title={`Retry as ${formatLabel(failureCopy(r).retry!)}`} onSelect={() => (close(), retry(r, failureCopy(r).retry!))} />
                            )}
                            <MenuItem icon="app/icon-file-secondary-16" title="Narrow the range" onSelect={() => (close(), setDialog({ template: r.template }))} />
                          </>
                        ) : (
                          <>
                            <MenuItem icon="app/icon-file-secondary-16" title="Open preview" disabled={r.status !== "ready"} onSelect={() => (close(), router.push(`/reports/${r.id}`))} />
                            <MenuItem icon="app/menu-export-16" title={`Download ${formatLabel(r.format)}`} disabled={r.status !== "ready"} onSelect={() => (close(), download(r))} />
                            <MenuItem icon="app/icon-users-secondary-16" title="Share" disabled={r.status !== "ready"} onSelect={() => (close(), setSharing(r))} />
                          </>
                        )
                      }
                    </RowMenu>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </PageBody>
      {dialog && <NewReportModal template={dialog.template} schedule={dialog.schedule} onClose={() => setDialog(null)} />}
      {sharing && <ShareReportModal id={sharing.id} name={sharing.name} meta={formatLabel(sharing.format)} onClose={() => setSharing(null)} />}
    </>
  );
}
