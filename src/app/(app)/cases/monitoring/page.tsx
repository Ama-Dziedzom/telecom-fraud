"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { DataTable, Pagination, rowClass, SkeletonRows, TableState, Td, Th } from "@/components/cases/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/Button";
import { useApi, type Page } from "@/lib/api/fd";
import { formatClock, formatDate } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Watch = {
  case_id: string;
  title: string;
  entities: string[];
  entity_counts: Record<string, number>;
  until: string;
  days_left: number;
  days_total: number;
  reopen_on_repeat: boolean;
  status: "quiet" | "near_miss" | "reopened";
  near_misses: number;
  reopened_at?: string;
  /** Engine text. */
  repeat_detail?: string;
};

const ENTITY: Record<string, [string, string]> = {
  wallet: ["wallet", "wallets"],
  agent: ["agent", "agents"],
  subscriber: ["subscriber", "subscribers"],
  staff_account: ["staff account", "staff accounts"],
  premium_number: ["premium number", "premium numbers"],
  cell: ["cell", "cells"],
  device: ["device", "devices"],
};
/** Agent codes read better than “1 agent” (“TM-0221”). */
const AGENT_CODE = /^[A-Z]{2}-\d{3,}$/;

/** { wallet: 4, agent: 1 } → “4 wallets, 1 agent”; a lone agent is named: “Agent TM-0221”. */
function watching(w: Watch) {
  const parts = Object.entries(w.entity_counts).map(([kind, n]) => {
    const agent = kind === "agent" && n === 1 ? w.entities.find((e) => AGENT_CODE.test(e)) : undefined;
    if (agent) return Object.keys(w.entity_counts).length === 1 ? `Agent ${agent}` : agent;
    const [one, many] = ENTITY[kind] ?? [kind.replace(/_/g, " "), `${kind.replace(/_/g, " ")}s`];
    return `${n} ${n === 1 ? one : many}`;
  });
  return parts.join(", ");
}

const STATUS = (w: Watch): { label: string; tone: BadgeTone } =>
  w.status === "reopened"
    ? { label: "Repeat · reopened", tone: "critical" }
    : w.near_misses
      ? { label: `${w.near_misses} near-${w.near_misses === 1 ? "miss" : "misses"}`, tone: "medium" }
      : { label: "No repeats", tone: "success" };

type Sort = "case" | "time" | null;

/** F2/F3 · Monitoring — closed cases still on watch. A repeat reopens the case. */
export default function MonitoringPage() {
  const router = useRouter();
  const { data, isLoading, error } = useApi<Page<Watch> & { totals: { cases: number; watched: number } }>("/watchlist?limit=25");
  const [sort, setSort] = useState<Sort>(null);
  const repeat = data?.data.find((w) => w.status === "reopened");

  // A reopened case leads; otherwise the order the API sends, unless a column is sorted.
  const rows = [...(data?.data ?? [])].sort((a, b) => {
    if (sort === "case") return b.case_id.localeCompare(a.case_id);
    if (sort === "time") return (b.status === "reopened" ? -1 : b.days_left) - (a.status === "reopened" ? -1 : a.days_left);
    return Number(b.status === "reopened") - Number(a.status === "reopened");
  });
  const count = data?.data.length ?? 0;

  return (
    <>
      <AppHeader title="Monitoring" />
      <PageBody>
        <PageHead title="Monitoring" subtitle="Closed cases still being watched. A repeat reopens the case." />
        <div className="flex flex-col gap-4">
          {repeat && (
            <Banner
              tone="error"
              title={`${repeat.case_id} reopened${repeat.reopened_at ? ` at ${formatClock(repeat.reopened_at)}` : ""}`}
              action={
                <ButtonLink href={`/cases/${repeat.case_id}`} variant="ghost" size="sm">
                  Open {repeat.case_id}
                </ButtonLink>
              }
            >
              {repeat.repeat_detail}
            </Banner>
          )}

          <DataTable footer={data && count > 0 ? <Pagination summary={`${count} ${count === 1 ? "case" : "cases"}`} /> : undefined}>
            <colgroup>
              <col className="w-[120px]" />
              <col />
              <col className="w-[260px]" />
              <col className="w-[180px]" />
              <col className="w-[200px]" />
            </colgroup>
            <thead>
              <tr>
                <Th sortable sorted={sort === "case"} onSort={() => setSort(sort === "case" ? null : "case")}>
                  Case
                </Th>
                <Th>What</Th>
                <Th>Watching</Th>
                <Th sortable sorted={sort === "time"} onSort={() => setSort(sort === "time" ? null : "time")}>
                  Time left
                </Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonRows check={false} widths={[64, [220, 160], 160, 90, "pill"]} />}
              {error && !data && (
                <TableState colSpan={5} icon="app/icon-alert-circle-tertiary-20" title="Couldn’t load monitoring">
                  Something went wrong. Try again in a moment.
                </TableState>
              )}
              {data && count === 0 && (
                <TableState colSpan={5} icon="app/icon-activity-info-22" title="Nothing on watch">
                  When you close a case and keep watching it, it shows here until the watch ends.
                </TableState>
              )}
              {rows.map((w) => {
                const s = STATUS(w);
                const reopened = w.status === "reopened";
                return (
                  <tr key={w.case_id} className={rowClass()} onClick={() => router.push(`/cases/${w.case_id}`)}>
                    <Td className="h-16">
                      <span className="font-mono text-mono-m text-text-primary">{w.case_id}</span>
                    </Td>
                    <Td className="h-16">
                      <span className="flex flex-col">
                        <span className="truncate text-label-s text-text-primary">{w.title.replace(/, /g, " · ")}</span>
                        {/* TODO(api): 0.2 /watchlist doesn’t say when or how the case closed (“Closed 21 Sep · confirmed fraud”). */}
                        <span className="truncate text-caption text-text-secondary">
                          {reopened && w.reopened_at ? `Reopened ${formatClock(w.reopened_at)}` : `Watched until ${formatDate(w.until)}`}
                        </span>
                      </span>
                    </Td>
                    <Td className="h-16">{watching(w)}</Td>
                    <Td className="h-16">{reopened ? "Stopped" : `${w.days_left} of ${w.days_total} days`}</Td>
                    <Td className="h-16">
                      <Badge label={s.label} tone={s.tone} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      </PageBody>
    </>
  );
}
