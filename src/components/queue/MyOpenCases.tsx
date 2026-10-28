"use client";

import { Card, CardLink, Skeleton, Tabs } from "@/components/app/Card";
import { CaseStatusBadge, RiskScore, SlaLabel } from "@/components/app/indicators";
import { fraudTypeLabel, type CaseStatus, type CaseSummary } from "@/lib/api/fd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CaseTab = "all" | Exclude<CaseStatus, "closed" | "new" | "reopened">;

const COLUMNS = [
  ["Case", "w-[120px]"],
  ["Subscriber", "w-[150px]"],
  ["Type", ""],
  ["Risk", "w-[140px]"],
  ["Status", "w-[170px]"],
  ["SLA", "w-[140px]"],
] as const;

const cell = "h-14 px-4";

/** Table wrapper, 40 header row (Caption, sentence case) and the 56 count row at the end. */
function CasesTable({ cases, now }: { cases: CaseSummary[]; now: number }) {
  const router = useRouter();
  return (
    // Fixed columns need ~860px; narrower cards scroll sideways rather than squeezing Type to nothing.
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-base">
      <table className="w-full min-w-[860px] table-fixed text-left">
        <thead className="border-b border-border-default bg-surface-raised">
          <tr>
            {COLUMNS.map(([label, width]) => (
              <th key={label} scope="col" className={`h-10 px-4 text-caption font-normal text-text-secondary ${width}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr
              key={c.id}
              onClick={() => router.push(`/cases/${c.id}`)}
              className="cursor-pointer border-b border-border-default hover:bg-surface-sunken"
            >
              <td className={cell}>
                <Link href={`/cases/${c.id}`} className="rounded font-mono text-mono-m text-text-primary">
                  {c.id}
                </Link>
              </td>
              <td className={`${cell} truncate text-body-s text-text-primary`}>{c.subscriber.msisdn}</td>
              <td className={`${cell} truncate text-body-s text-text-primary`}>{fraudTypeLabel(c.fraud_type)}</td>
              <td className={cell}>
                <RiskScore score={c.risk_score} />
              </td>
              <td className={cell}>
                <CaseStatusBadge status={c.status} />
              </td>
              <td className={cell}>
                <SlaLabel dueAt={c.sla_due_at} now={now} />
              </td>
            </tr>
          ))}
          {cases.length === 0 && (
            <tr className="border-b border-border-default">
              <td colSpan={6} className="h-14 px-4 text-center text-body-s text-text-secondary">
                No cases here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="flex h-14 items-center px-4 text-caption text-text-secondary">
        {cases.length} {cases.length === 1 ? "case" : "cases"}
      </p>
    </div>
  );
}

/** A1 · My queue · My open cases — status tabs over the table. */
export function MyOpenCases({ cases, now }: { cases: CaseSummary[]; now: number }) {
  const [tab, setTab] = useState<CaseTab>("all");
  const count = (s: CaseStatus) => cases.filter((c) => c.status === s).length;
  return (
    <Card title="My open cases" aside={<CardLink href="/cases">View in cases</CardLink>}>
      <Tabs
        label="Filter my cases"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "all", label: "All", count: cases.length },
          { id: "investigating", label: "Investigating", count: count("investigating") },
          { id: "escalated", label: "Escalated", count: count("escalated") },
          { id: "sent_back", label: "Sent back", count: count("sent_back") },
          { id: "pending_decision", label: "Pending decision", count: count("pending_decision") },
        ]}
      />
      <CasesTable cases={tab === "all" ? cases : cases.filter((c) => c.status === tab)} now={now} />
    </Card>
  );
}

/** A2 · Loading — the same card and table chrome with skeleton cells. */
export function MyOpenCasesSkeleton() {
  return (
    <Card title="My open cases">
      <div aria-hidden className="overflow-hidden rounded-lg border border-border-default bg-surface-base">
        <div className="flex h-10 items-center border-b border-border-default bg-surface-raised px-4">
          {COLUMNS.map(([label, width]) => (
            <span key={label} className={width || "flex-1"}>
              <Skeleton className="h-2 w-8 rounded-full" />
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, r) => (
          <div key={r} className="flex h-14 items-center border-b border-border-default px-4 last:border-b-0">
            <span className="w-[120px]"><Skeleton className="h-2.5 w-16 rounded-full" /></span>
            <span className="w-[150px]"><Skeleton className="h-2.5 w-20 rounded-full" /></span>
            <span className="flex-1"><Skeleton className="h-2.5 w-32 rounded-full" /></span>
            <span className="w-[140px]"><Skeleton className="h-2.5 w-12 rounded-full" /></span>
            <span className="w-[170px]"><Skeleton className="h-5 w-24 rounded-full" /></span>
            <span className="w-[140px]"><Skeleton className="h-2.5 w-16 rounded-full" /></span>
          </div>
        ))}
      </div>
    </Card>
  );
}
