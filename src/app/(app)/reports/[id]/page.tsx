"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Card, Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { CaseStatusBadge } from "@/components/app/indicators";
import { formatLabel, NewReportModal, ShareReportModal, templateLabel, type Report } from "@/components/reports/ReportModals";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { fraudTypeLabel, useApi, type CaseStatus, type Money, type PersonRef } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, TZ } from "@/lib/time";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

type Preview = Report & {
  generated_by: PersonRef;
  generated_at: string;
  /** A date: `2027-01-18`. */
  expires_at: string;
  rows: number;
  preview: {
    summary: { cases: number; closed: number; open: number; confirmed_fraud: number; lost: Money; false_positive: number; recovered: Money };
    columns: number;
    total_rows: number;
    rows: Array<{ case_id: string; fraud_type: string; status: CaseStatus; outcome: string | null; loss: Money; closed_at: string | null }>;
  };
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** The four tiles above the preview: label, number, the line under it, and whether it reads as good news. */
function summaryTiles({ summary: s }: Preview["preview"]) {
  return [
    { label: "Cases", value: String(s.cases), sub: `${s.closed} closed · ${s.open} open`, good: false },
    { label: "Confirmed fraud", value: String(s.confirmed_fraud), sub: `${formatMoney(s.lost.amount_minor, s.lost.currency)} lost`, good: false },
    { label: "False positive", value: String(s.false_positive), sub: `${pct(s.false_positive, s.closed)}% of closed`, good: false },
    { label: "Recovered", value: formatMoney(s.recovered.amount_minor, s.recovered.currency), sub: `${pct(s.recovered.amount_minor, s.lost.amount_minor)}% of loss`, good: true },
  ];
}

/** 18 Jan 2027, from `2027-01-18`. */
const dayOnly = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

const OUTCOME: Record<string, { label: string; tone: "critical" | "success" | "neutral" }> = {
  confirmed_fraud: { label: "Confirmed fraud", tone: "critical" },
  false_positive: { label: "False positive", tone: "success" },
  inconclusive: { label: "Inconclusive", tone: "neutral" },
};

/** H12/H14 · Report ready — a preview of what’s inside, with share, schedule and download. */
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, error } = useApi<Preview>(`/reports/${id}`);
  const [dialog, setDialog] = useState<null | "share" | "schedule">(null);

  const download = async () => {
    await apiFetch("GET", `/reports/${id}/download`);
    toast({ tone: "success", title: "Your report is downloading", body: `${data?.name} · ${data?.rows} rows · ${data ? formatLabel(data.format) : ""}` });
  };

  if (error) {
    return (
      <>
        <AppHeader section="Reports" title="Report" />
        <PageBody>
          <EmptyState icon="app/icon-file-brand-20" tone="brand" title="This report isn’t available" className="min-h-[300px]" actions={<ButtonLink href="/reports" size="md">Back to reports</ButtonLink>}>
            It may have expired (reports are kept for 90 days) or been deleted.
          </EmptyState>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <AppHeader section="Reports" title={data?.name ?? "Report"} />
      <PageBody>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-overline text-text-brand uppercase">Report</p>
            <h2 className="text-h1 text-text-primary">{data?.name ?? "…"}</h2>
            <p className="text-body-s text-text-secondary">
              {data ? `${templateLabel(data.template)} · generated ${formatClock(data.generated_at)} by ${data.generated_by.name} · ${data.rows} rows · expires ${dayOnly(data.expires_at)}` : " "}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="md" disabled={!data} onClick={() => setDialog("share")} iconLeft={<Icon name="app/icon-users-secondary-18" size={18} />}>
              Share
            </Button>
            <Button variant="secondary" size="md" disabled={!data} onClick={() => setDialog("schedule")} iconLeft={<Icon name="app/icon-clock-secondary-18" size={18} />}>
              Schedule
            </Button>
            <Button size="md" disabled={!data} onClick={download} iconLeft={<Icon name="app/icon-download-white-18" size={18} />}>
              Download {data ? formatLabel(data.format) : ""}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {(data ? summaryTiles(data.preview) : Array.from({ length: 4 }, () => null)).map((k, i) =>
            k ? (
              <div key={k.label} className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-base px-5 py-4">
                <span className="text-caption text-text-secondary">{k.label}</span>
                <span className="text-h1 text-text-primary">{k.value}</span>
                <span className={cn("text-caption", k.good ? "text-success-fg" : "text-text-secondary")}>{k.sub}</span>
              </div>
            ) : (
              <Skeleton key={i} className="h-[108px] rounded-xl" />
            ),
          )}
        </div>

        <Card
          title={data ? `Preview · first ${data.preview.rows.length} of ${data.preview.total_rows} rows` : "Preview"}
          icon="app/icon-file-secondary-18"
          aside={data ? <span className="text-caption text-text-tertiary">Columns: {data.preview.columns} · showing 6</span> : undefined}
        >
          {!data ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <div className="overflow-hidden rounded-[10px] border border-border-subtle">
              <table className="w-full text-left">
                <thead className="bg-surface-raised">
                  <tr className="text-overline text-text-tertiary uppercase">
                    <th className="w-[120px] py-2.5 pl-3.5 font-bold">Case</th>
                    <th className="py-2.5 font-bold">Type</th>
                    <th className="w-[150px] py-2.5 font-bold">Status</th>
                    <th className="w-[200px] py-2.5 font-bold">Outcome</th>
                    <th className="w-[130px] py-2.5 text-right font-bold">Loss</th>
                    <th className="w-[100px] py-2.5 pr-3.5 text-right font-bold">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.preview.rows.map((r) => (
                    <tr key={r.case_id} className="border-t border-border-subtle">
                      <td className="py-2.5 pl-3.5">
                        <Link href={`/cases/${r.case_id}`} className="rounded font-mono text-mono-m text-text-brand hover:underline">
                          {r.case_id}
                        </Link>
                      </td>
                      <td className="py-2.5 text-body-s text-text-primary">{fraudTypeLabel(r.fraud_type)}</td>
                      <td className="py-2.5">
                        <CaseStatusBadge status={r.status} />
                      </td>
                      <td className="py-2.5">{r.outcome && OUTCOME[r.outcome] ? <Badge label={OUTCOME[r.outcome].label} tone={OUTCOME[r.outcome].tone} /> : <span className="text-text-tertiary">—</span>}</td>
                      <td className={cn("py-2.5 text-right font-mono text-mono-m", r.loss.amount_minor ? "font-semibold text-text-primary" : "text-text-secondary")}>{formatMoney(r.loss.amount_minor, r.loss.currency)}</td>
                      <td className="py-2.5 pr-3.5 text-right text-caption text-text-secondary">
                        {r.closed_at ? new Date(r.closed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>
      {dialog === "share" && data && <ShareReportModal id={data.id} name={data.name} meta={`${formatLabel(data.format)} · ${data.rows} rows`} onClose={() => setDialog(null)} />}
      {dialog === "schedule" && <NewReportModal template="case_list" schedule onClose={() => setDialog(null)} />}
    </>
  );
}
