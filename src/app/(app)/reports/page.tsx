"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton, Tabs } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { formatLabel, NewReportModal, nextRunLabel, scheduleLabel, sharedLabel, templateLabel, TEMPLATES, type Report } from "@/components/reports/ReportModals";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type Page } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatClockOrDay, useNow } from "@/lib/time";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type List = Page<Report> & { counts: { all: number; scheduled: number; shared: number } };

/** Why a report failed, in the app’s words, and the format to retry in. */
function failureCopy(r: Report) {
  if (r.error?.code === "export_too_large" && r.format !== "csv") {
    return { detail: `It’s over the size limit for ${formatLabel(r.format)}. Retry as CSV (no limit), or narrow the date range.`, retry: "csv" as const };
  }
  if (r.error?.code === "export_too_large") return { detail: "It’s over the size limit. Narrow the date range and try again.", retry: null };
  return { detail: "Something went wrong while it was being generated. Try again.", retry: r.format };
}

const when = (iso: string, now: number) => {
  const d = formatClockOrDay(iso, now);
  return /^\d\d:\d\d$/.test(d) ? `Today ${d}` : d;
};

/** H6/H10/H11/H13/H15 · Reports — templates, the library, scheduled reports and failures. */
export default function ReportsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const { mutate } = useSWRConfig();
  const [tab, setTab] = useState<"all" | "scheduled" | "shared">("all");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<null | { template?: string; schedule?: boolean }>(null);
  const qs = new URLSearchParams({ tab });
  if (q.trim()) qs.set("q", q.trim());
  if (params.get("demo")) qs.set("demo", params.get("demo")!);
  const key = `/reports?${qs}`;
  const { data } = useApi<List>(key, { refreshInterval: (d) => (d?.data.some((r) => r.status === "building") ? 1500 : 0) });
  const failed = data?.data.find((r) => r.status === "failed");
  const failure = failed && failureCopy(failed);
  const empty = data && data.counts.all === 0 && !q;
  const refresh = () => mutate((k) => typeof k === "string" && k.startsWith("/reports"));

  const download = async (r: Report) => {
    const res = await apiFetch<{ url: string }>("GET", `/reports/${r.id}/download`);
    toast({ tone: "success", title: `Downloading ${r.name}`, body: `${formatLabel(r.format)} · link valid for 24 hours.` });
    void res;
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

  return (
    <>
      <AppHeader section="Insights" title="Reports" />
      <PageBody>
        <PageHead
          title="Reports"
          subtitle="Generate a report once or put it on a schedule. Finished reports are kept for 90 days."
          actions={
            <Button size="md" onClick={() => setDialog({})} iconLeft={<Icon name="app/icon-plus-white-18" size={18} />}>
              New report
            </Button>
          }
        />

        {failed && failure && (
          <>
            <section role="alert" className="flex items-start gap-3 rounded-xl border border-critical-border bg-critical-bg px-4 py-3">
              <Icon name="icon-alert-circle-critical-20" size={18} className="mt-0.5 shrink-0" />
              <span className="flex flex-col gap-0.5">
                <span className="text-label-m text-critical-fg">“{failed.name}” couldn’t be generated</span>
                <span className="text-body-s text-text-primary">{failure.detail}</span>
              </span>
            </section>
            <div className="flex gap-2">
              {failure.retry && (
                <Button size="sm" onClick={() => retry(failed, failure.retry!)} iconLeft={<Icon name="app/icon-refresh-white-18" size={14} />}>
                  Retry as {formatLabel(failure.retry)}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setDialog({ template: "case_list" })}>
                Edit range
              </Button>
            </div>
          </>
        )}

        {!failed && !empty && tab === "all" && (
          <div className="flex flex-col gap-3">
            <p className="text-overline text-text-tertiary uppercase">Start from a template</p>
            <div className="grid grid-cols-4 gap-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDialog({ template: t.id })}
                  className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-base px-4 py-3 text-left hover:border-brand-primary"
                >
                  <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-primary-subtle">
                    <Icon name={t.icon} size={18} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-label-m text-text-primary">{t.label}</span>
                    <span className="text-caption text-text-secondary">{t.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Tabs
              label="Reports"
              value={tab}
              onChange={(v) => setTab(v as typeof tab)}
              tabs={[
                { id: "all", label: "All", count: data?.counts.all },
                { id: "scheduled", label: "Scheduled", count: data?.counts.scheduled },
                { id: "shared", label: "Shared with me", count: data?.counts.shared },
              ]}
            />
          </div>
          <label className="mb-2 flex h-10 w-[300px] items-center gap-2.5 rounded-lg border border-border-default bg-surface-base px-3.5 focus-within:border-border-focus focus-within:shadow-focus">
            <Icon name="app/icon-search-18" size={18} />
            <input type="search" aria-label="Search reports" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports" className="min-w-0 flex-1 bg-transparent text-body-m outline-none focus-visible:shadow-none" />
          </label>
        </div>

        {!data ? (
          <Skeleton className="h-[300px] w-full rounded-xl" />
        ) : empty ? (
          <EmptyState
            icon="app/icon-file-brand-20"
            tone="brand"
            title="No reports yet"
            className="min-h-[270px]"
            actions={
              <>
                <Button variant="secondary" size="md" onClick={() => setDialog({ template: "fraud_summary" })} iconLeft={<Icon name="app/icon-chart-secondary-18" size={18} />}>
                  Fraud summary
                </Button>
                <Button size="md" onClick={() => setDialog({ template: "case_list" })} iconLeft={<Icon name="app/icon-folder-white-18" size={18} />}>
                  My cases report
                </Button>
              </>
            }
          >
            Start with “My cases” for your own work log, or a fraud summary for your team. You can put any report on a schedule and it’ll arrive in your inbox.
          </EmptyState>
        ) : (
          <div className="overflow-visible rounded-xl border border-border-subtle bg-surface-base">
            <table className="w-full text-left">
              <thead className="border-b border-border-subtle bg-surface-raised">
                <tr className="text-overline text-text-tertiary uppercase">
                  <th className="py-[11px] pl-5 font-bold">Report</th>
                  <th className="w-[150px] py-[11px] font-bold">Schedule</th>
                  <th className="w-[160px] py-[11px] font-bold">{tab === "scheduled" ? "Next run" : "Status"}</th>
                  <th className="w-[130px] py-[11px] font-bold">{tab === "scheduled" ? "Sent to" : "Last run"}</th>
                  {tab !== "scheduled" && <th className="w-[90px] py-[11px] font-bold">Format</th>}
                  <th className="w-[150px] py-[11px] font-bold">{tab === "scheduled" ? "Status" : "Shared with"}</th>
                  <th className="w-[100px] py-[11px] pr-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => r.status === "ready" && router.push(`/reports/${r.id}`)}
                    className={cn(
                      "border-b border-border-subtle last:border-b-0",
                      r.status === "ready" && "cursor-pointer hover:bg-[#fbfaff]",
                      r.status === "building" && "bg-surface-raised",
                      r.status === "failed" && "shadow-[inset_3px_0_0_#b51c1c]",
                    )}
                  >
                    <td className="py-3 pl-5">
                      <p className="text-label-m text-text-primary">{r.name}</p>
                      <p className="text-caption text-text-secondary">{templateLabel(r.template)}</p>
                    </td>
                    <td className="py-3 text-body-s text-text-primary">{scheduleLabel(r.schedule)}</td>
                    {tab === "scheduled" ? (
                      <>
                        <td className="py-3 text-body-s text-text-primary">{r.schedule?.paused || !r.next_run_at ? "—" : nextRunLabel(r.next_run_at)}</td>
                        <td className="py-3 text-body-s text-text-secondary">{sharedLabel(r.shared_with)}</td>
                        <td className="py-3">{r.schedule?.paused ? <Badge label="Paused" tone="neutral" dot /> : <Badge label="Active" tone="success" dot />}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-3">
                          {r.status === "building" ? (
                            <span className="flex items-center gap-1.5 text-label-s text-text-brand">
                              <Icon name="spinner-brand-20" size={14} className="animate-spin" />
                              Generating · {r.progress_pct ?? 0}%
                            </span>
                          ) : r.status === "failed" ? (
                            <Badge label="Failed" tone="critical" dot />
                          ) : (
                            <Badge label="Ready" tone="success" dot />
                          )}
                        </td>
                        <td className="py-3 text-body-s text-text-secondary">{r.status === "building" ? `Started ${formatClock(r.last_run_at)}` : when(r.last_run_at, now)}</td>
                        <td className="py-3">
                          <Badge label={formatLabel(r.format)} tone="neutral" />
                        </td>
                        <td className="py-3 text-body-s text-text-secondary">{sharedLabel(r.shared_with)}</td>
                      </>
                    )}
                    <td className="py-3 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                      {tab === "scheduled" ? (
                        <Menu
                          label={`Actions for ${r.name}`}
                          width={220}
                          trigger={(t) => (
                            <button
                              type="button"
                              aria-label={`Actions for ${r.name}`}
                              onClick={t.toggle}
                              aria-expanded={t["aria-expanded"]}
                              aria-haspopup="menu"
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-border-default"
                            >
                              <Icon name="app/icon-more-20" size={16} />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuItem icon="app/icon-refresh-16" title="Run now" onSelect={() => (close(), scheduleAction(r, "run"))} />
                              <MenuItem icon="app/icon-sliders-18" title="Edit schedule" onSelect={() => (close(), setDialog({ template: "case_list", schedule: true }))} />
                              <MenuItem
                                icon="app/icon-clock-secondary-18"
                                title={r.schedule?.paused ? "Resume" : "Pause"}
                                description={r.schedule?.paused ? undefined : "Keeps it listed; no emails"}
                                onSelect={() => (close(), scheduleAction(r, r.schedule?.paused ? "resume" : "pause"))}
                              />
                              <MenuDivider />
                              <MenuItem icon="app/icon-x-critical-16" title="Delete" tone="critical" onSelect={() => (close(), scheduleAction(r, "delete"))} />
                            </>
                          )}
                        </Menu>
                      ) : r.status === "failed" ? (
                        <button type="button" onClick={() => retry(r)} className="inline-flex items-center gap-1.5 rounded text-label-s text-text-brand hover:underline">
                          <Icon name="app/icon-refresh-brand-22" size={14} />
                          Retry
                        </button>
                      ) : r.status === "ready" ? (
                        <button type="button" aria-label={`Download ${r.name}`} onClick={() => download(r)} className="inline-flex size-8 items-center justify-center rounded-lg border border-border-default">
                          <Icon name="app/icon-download-18" size={16} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
      {dialog && <NewReportModal template={dialog.template} schedule={dialog.schedule} onClose={() => setDialog(null)} />}
    </>
  );
}
