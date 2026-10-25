"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { RiskScore } from "@/components/app/indicators";
import { WatchModal } from "@/components/lookup/LookupModals";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { useParams } from "next/navigation";
import { useState } from "react";

type Row = { id: string; msisdn: string; ghana_card: string; activated: string; recent: boolean; calls_per_day: number; risk_score: number; suggested: boolean };
type Bulk = { id: string; file_name: string; case_id: string; total: number; skipped: number; pattern: { title: string; detail: string } | null; data: Row[] };

/** G19 · Bulk lookup results — sorted by risk, with the pattern called out and a bulk bar. */
export default function BulkResultsPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  // TODO(api): proposed GET /lookups/bulk/{id}.
  const { data } = useApi<Bulk>(`/lookups/bulk/${id}`);
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
    const body = ["number,ghana_card,activated,calls_per_day,risk", ...rows.map((r) => [r.msisdn, r.ghana_card, r.activated, r.calls_per_day, r.risk_score].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `${data?.file_name.replace(/\.csv$/, "") ?? "bulk"}-results.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const addToCase = async () => {
    if (!data) return;
    setAdding(true);
    try {
      // TODO(api): proposed POST /cases/{id}/entities.
      await apiFetch("POST", `/cases/${data.case_id}/entities`, { entity_ids: Array.from(selected), source: `bulk:${data.id}` });
      toast({ tone: "success", title: `${selected.size} numbers added to ${data.case_id}`, body: "They’re on the case network and in Evidence as a lookup export." });
      setPicked(new Set());
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <AppHeader section="Subscriber lookup" title={data ? `Bulk lookup · ${data.total}` : "Bulk lookup"} />
      <PageBody>
        <PageHead
          title={data ? `Bulk lookup · ${data.total} numbers` : "Bulk lookup"}
          subtitle={data ? `${data.file_name} · for ${data.case_id} · ${data.skipped} rows skipped` : " "}
          actions={
            <Button variant="secondary" size="md" onClick={exportCsv} disabled={!rows.length} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
              Export
            </Button>
          }
        />
        {data?.pattern && (
          <Banner tone="warning" title={data.pattern.title}>
            {data.pattern.detail}
          </Banner>
        )}
        {!data ? (
          <Skeleton className="h-[320px] w-full rounded-xl" />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
              <table className="w-full text-left">
                <thead className="border-b border-border-subtle bg-surface-raised">
                  <tr className="text-overline text-text-tertiary uppercase">
                    <th className="w-[54px] py-[11px] pl-5">
                      <Checkbox label="Select all" hideLabel checked={all} indeterminate={selected.size > 0 && !all} onChange={(e) => setPicked(new Set(e.target.checked ? rows.map((r) => r.id) : []))} />
                    </th>
                    <th className="py-[11px] font-bold">Number</th>
                    <th className="py-[11px] font-bold">Ghana Card</th>
                    <th className="py-[11px] font-bold">Activated</th>
                    <th className="py-[11px] font-bold">Usage</th>
                    <th className="w-[160px] py-[11px] pr-5 font-bold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("border-b border-border-subtle last:border-b-0", selected.has(r.id) && "bg-brand-primary-subtle/50")}>
                      <td className="py-3 pl-5">
                        <Checkbox label={`Select ${r.msisdn}`} hideLabel checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} />
                      </td>
                      <td className="py-3 font-mono text-mono-m font-semibold text-text-primary">{r.msisdn}</td>
                      <td className="py-3 font-mono text-mono-s text-text-secondary">{r.ghana_card}</td>
                      <td className={cn("py-3 text-body-s", r.recent ? "text-medium-fg" : "text-text-secondary")}>{r.activated}</td>
                      <td className="py-3 text-body-s text-text-secondary">{r.calls_per_day.toLocaleString("en-GB")} calls/day</td>
                      <td className="py-3 pr-5">
                        <RiskScore score={r.risk_score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-caption text-text-secondary">
              Showing {rows.length} of {data.total} · sorted by risk
            </p>
          </>
        )}
      </PageBody>

      {data && selected.size > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="fixed bottom-16 left-[calc(50%+150px)] z-30 flex w-[720px] -translate-x-1/2 items-center gap-3 rounded-xl bg-brand-ink px-4 py-3 shadow-lg">
          <span className="flex-1 text-label-m text-text-inverse">{selected.size} selected</span>
          <Button variant="secondary" size="md" onClick={() => setWatching(true)} iconLeft={<Icon name="app/icon-eye-primary-18" size={18} />}>
            Add to watchlist
          </Button>
          <Button size="md" loading={adding} onClick={addToCase} iconLeft={<Icon name="app/icon-folder-white-18" size={18} />}>
            Add to {data.case_id}
          </Button>
        </div>
      )}
      {watching && data && (
        <WatchModal title={`Watch ${selected.size} numbers`} subtitle={`From ${data.file_name} · ${data.case_id}`} entityIds={Array.from(selected)} caseId={data.case_id} onClose={() => setWatching(false)} />
      )}
    </>
  );
}
