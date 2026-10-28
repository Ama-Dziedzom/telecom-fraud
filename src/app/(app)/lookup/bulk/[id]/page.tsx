"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { RiskScore } from "@/components/app/indicators";
import { localMsisdn } from "@/components/cases/CaseTable";
import { BulkAction, BulkBar, CheckCell, DataTable, Pagination, Td, Th, rowClass } from "@/components/cases/Table";
import { WatchModal } from "@/components/lookup/LookupModals";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type Page } from "@/lib/api/fd";
import { TZ } from "@/lib/time";
import { useParams } from "next/navigation";
import { useState } from "react";

type Row = {
  id: string;
  msisdn: string;
  ghana_card: string;
  activated_on: string;
  recent: boolean;
  calls_per_day: number;
  risk_score: number;
  suggested: boolean;
};
type Bulk = Page<Row> & {
  id: string;
  status: "running" | "done";
  file_name: string;
  case_id: string;
  total: number;
  skipped: number;
  /** Engine text. */
  pattern: { title: string; detail: string } | null;
};

/** Recent activations by month (“Aug 2026”), older ones by year (“2019”). */
const activated = (r: Row) =>
  new Date(r.activated_on).toLocaleDateString("en-GB", r.recent ? { month: "short", year: "numeric", timeZone: TZ } : { year: "numeric", timeZone: TZ });

/** G19 · Bulk lookup results — sorted by risk, with the pattern called out and the bulk action bar over the table. */
export default function BulkResultsPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data } = useApi<Bulk>(`/lookups/bulk/${id}`, {
    refreshInterval: (b) => (b?.status === "running" ? 2000 : 0),
  });
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [watching, setWatching] = useState(false);
  const [adding, setAdding] = useState(false);
  const selected = picked ?? new Set(data?.data.filter((r) => r.suggested).map((r) => r.id) ?? []);
  const rows = data?.data ?? [];
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (rid: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(rid);
    else next.delete(rid);
    setPicked(next);
  };

  const exportCsv = () => {
    const body = ["number,ghana_card,activated,calls_per_day,risk", ...rows.map((r) => [r.msisdn, r.ghana_card, r.activated_on, r.calls_per_day, r.risk_score].join(","))].join(
      "\n",
    );
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    Object.assign(document.createElement("a"), {
      href: url,
      download: `${data?.file_name.replace(/\.csv$/, "") ?? "bulk"}-results.csv`,
    }).click();
    URL.revokeObjectURL(url);
  };

  const addToCase = async () => {
    if (!data) return;
    setAdding(true);
    try {
      // TODO(api): bulk rows carry no entity ID, so the row IDs are sent.
      await apiFetch("POST", `/cases/${data.case_id}/entities`, {
        entity_ids: Array.from(selected),
        note: `From bulk lookup ${data.id} (${data.file_name})`,
      });
      toast({
        tone: "success",
        title: `${selected.size} numbers added to ${data.case_id}`,
        body: "They’re on the case network and in Evidence as a lookup export.",
      });
      setPicked(new Set());
    } finally {
      setAdding(false);
    }
  };

  // “6 selected · All on Ghana Cards GHA-71…-2 or GHA-88…-9” when the picked rows share cards.
  const cards = Array.from(new Set(rows.filter((r) => selected.has(r.id)).map((r) => r.ghana_card)));
  const sorted = rows.slice().sort((a, b) => b.risk_score - a.risk_score);

  return (
    <>
      <AppHeader section="Subscriber lookup" title={data ? `Bulk lookup · ${data.total}` : "Bulk lookup"} />
      <PageBody>
        <PageHead
          title={data ? `Bulk lookup · ${data.total} numbers` : "Bulk lookup"}
          subtitle={data ? `${data.file_name} · for ${data.case_id} · ${data.skipped} rows skipped` : " "}
          actions={
            <Button variant="secondary" size="md" onClick={exportCsv} disabled={!rows.length}>
              Export
            </Button>
          }
        />
        {data?.pattern && (
          <Banner tone="warning" icon="app/icon-alert-triangle-medium-16" title={data.pattern.title.replace(/^Pattern: /, "")}>
            {data.pattern.detail}
          </Banner>
        )}
        {!data ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : (
          <div className="flex flex-col gap-4">
            {selected.size > 0 && (
              <BulkBar
                count={selected.size}
                detail={cards.length && cards.length <= 2 ? `All on Ghana ${cards.length === 1 ? "Card" : "Cards"} ${cards.join(" or ")}` : undefined}
                onClear={() => setPicked(new Set())}
              >
                <BulkAction onClick={() => setWatching(true)}>Add to watchlist</BulkAction>
                <BulkAction loading={adding} onClick={addToCase}>
                  Add to {data.case_id}
                </BulkAction>
              </BulkBar>
            )}
            <DataTable footer={<Pagination summary={`Showing 1-${rows.length} of ${data.total}`} />}>
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[140px]" />
              </colgroup>
              <thead>
                <tr>
                  <CheckCell
                    head
                    label="Select all"
                    checked={all}
                    indeterminate={selected.size > 0 && !all}
                    onChange={(on) => setPicked(new Set(on ? rows.map((r) => r.id) : []))}
                  />
                  <Th>Number</Th>
                  <Th>Ghana Card</Th>
                  <Th>Activated</Th>
                  <Th align="right">Calls a day</Th>
                  <Th sorted>Risk</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const on = selected.has(r.id);
                  return (
                    <tr key={r.id} onClick={() => toggle(r.id, !on)} className={rowClass(on)}>
                      <CheckCell label={`Select ${r.msisdn}`} checked={on} onChange={(v) => toggle(r.id, v)} />
                      <Td>{localMsisdn(r.msisdn)}</Td>
                      <Td>{r.ghana_card.replace("…", "***")}</Td>
                      <Td>{activated(r)}</Td>
                      <Td align="right">{r.calls_per_day.toLocaleString("en-GB")}</Td>
                      <Td clip={false}>
                        <RiskScore score={r.risk_score} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        )}
      </PageBody>

      {watching && data && (
        <WatchModal
          title={`Watch ${selected.size} numbers`}
          subtitle={`From ${data.file_name} · ${data.case_id}`}
          entityIds={Array.from(selected)}
          caseId={data.case_id}
          onClose={() => setWatching(false)}
        />
      )}
    </>
  );
}
