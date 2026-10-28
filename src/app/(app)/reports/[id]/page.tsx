"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card, CardMeta } from "@/components/app/Card";
import { CaseStatusBadge } from "@/components/app/indicators";
import { CardSkeleton, InlineState, StatTile, StatTileSkeleton } from "@/components/reports/Insights";
import { formatLabel, ShareReportModal, templateLabel, type Report } from "@/components/reports/ReportModals";
import { DataTable, Td, Th, THead, Tr } from "@/components/reports/Table";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { fraudTypeLabel, useApi, type CaseStatus, type Money, type PersonRef } from "@/lib/api/fd";
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
const money = (m: Money) => formatMoney(m.amount_minor, m.currency);

/** The four stat tiles above the preview: label, number and the line under it. */
function summaryTiles({ summary: s }: Preview["preview"]) {
  return [
    { label: "Cases", value: String(s.cases), delta: `${s.closed} closed · ${s.open} open` },
    { label: "Confirmed fraud", value: String(s.confirmed_fraud), delta: `${money(s.lost)} lost` },
    { label: "False positive", value: String(s.false_positive), delta: `${pct(s.false_positive, s.closed)}% of closed` },
    { label: "Recovered", value: money(s.recovered), delta: `${pct(s.recovered.amount_minor, s.lost.amount_minor)}% of the loss` },
  ];
}

/** 18 Jan 2027, from `2027-01-18`. */
const dayOnly = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

const OUTCOME: Record<string, { label: string; tone: "critical" | "success" | "neutral" }> = {
  confirmed_fraud: { label: "Confirmed fraud", tone: "critical" },
  false_positive: { label: "False positive", tone: "success" },
  inconclusive: { label: "Inconclusive", tone: "neutral" },
};

/** H12/H14 · Report ready — a preview of what’s inside, with share and download. */
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, error } = useApi<Preview>(`/reports/${id}`);
  const [sharing, setSharing] = useState(false);

  const download = async () => {
    await apiFetch("GET", `/reports/${id}/download`);
    toast({ tone: "success", title: "Your report is downloading", body: `${data?.name} · ${data?.rows} rows · ${data ? formatLabel(data.format) : ""}` });
  };

  if (error) {
    return (
      <>
        <AppHeader section="Reports" title="Report" />
        <PageBody className="flex flex-1 flex-col gap-4 px-8 pt-6 pb-8">
          <div className="rounded-lg border border-border-default bg-surface-base">
            <InlineState
              icon="app/icon-inbox-tertiary-20"
              title="This report isn’t available"
              actions={
                <ButtonLink href="/reports" variant="secondary" size="md">
                  Back to reports
                </ButtonLink>
              }
            >
              It may have expired (reports are kept for 90 days) or been deleted.
            </InlineState>
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <AppHeader section="Reports" title={data?.name ?? "Report"} />
      <PageBody className="flex flex-1 flex-col gap-4 px-8 pt-6 pb-8">
        <PageHead
          title={data?.name ?? "Report"}
          subtitle={
            data
              ? `${templateLabel(data.template)} · generated ${formatClock(data.generated_at)} by ${data.generated_by.name} · ${data.rows} rows · kept until ${dayOnly(data.expires_at)}`
              : "Loading"
          }
          actions={
            <>
              <Button variant="secondary" size="md" disabled={!data} onClick={() => setSharing(true)}>
                Share
              </Button>
              <Button size="md" disabled={!data} onClick={download}>
                Download {data ? formatLabel(data.format) : ""}
              </Button>
            </>
          }
        />

        <div className="flex gap-3">
          {data
            ? summaryTiles(data.preview).map((k) => <StatTile key={k.label} label={k.label} value={k.value} delta={k.delta} />)
            : Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />)}
        </div>

        {!data ? (
          <CardSkeleton />
        ) : (
          <Card
            title={`Preview · first ${data.preview.rows.length} of ${data.preview.total_rows} rows`}
            aside={
              <CardMeta>
                {data.preview.columns} columns · showing 6
              </CardMeta>
            }
          >
            <div className="pb-1">
              <DataTable>
                <THead>
                  <Th className="w-[120px]">Case</Th>
                  <Th>Type</Th>
                  <Th className="w-[160px]">Status</Th>
                  <Th className="w-[180px]">Outcome</Th>
                  <Th align="right" className="w-[130px]">
                    Loss
                  </Th>
                  <Th className="w-[100px]">Closed</Th>
                </THead>
                <tbody>
                  {data.preview.rows.map((r) => (
                    <Tr key={r.case_id}>
                      <Td>
                        <Link href={`/cases/${r.case_id}`} className="rounded font-mono text-mono-m text-text-primary hover:underline">
                          {r.case_id}
                        </Link>
                      </Td>
                      <Td>{fraudTypeLabel(r.fraud_type)}</Td>
                      <Td>
                        <CaseStatusBadge status={r.status} />
                      </Td>
                      <Td>{r.outcome && OUTCOME[r.outcome] ? <Badge label={OUTCOME[r.outcome].label} tone={OUTCOME[r.outcome].tone} /> : <Badge label="Not yet" tone="neutral" />}</Td>
                      <Td align="right">{money(r.loss)}</Td>
                      <Td>{r.closed_at ? new Date(r.closed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ }) : "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </Card>
        )}
      </PageBody>
      {sharing && data && <ShareReportModal id={data.id} name={data.name} meta={`${formatLabel(data.format)} · ${data.rows} rows`} onClose={() => setSharing(false)} />}
    </>
  );
}
