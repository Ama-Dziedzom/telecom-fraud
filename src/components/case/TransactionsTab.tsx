"use client";

import { Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/cases";
import { useApi, type TransactionPage } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, formatWhen } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";

const TYPE_LABEL: Record<string, string> = {
  agent_cash_out: "Agent cash-out",
  transfer: "Transfer",
  airtime: "Airtime",
  merchant: "Merchant",
  transfer_in: "Transfer in",
};

/** Already gone: cashed out at an agent or onwards — a red edge on the row. */
const lost = (t: Transaction) => t.where_now === "cashed_out" || t.where_now === "agent_holds";
const money = (minor: number, currency = "GHS") => formatMoney(minor, currency);

/** C5 · Transactions — pick transfers to save as evidence, reverse or copy. */
export function TransactionsTab({
  caseId,
  subscriberId,
  now,
  onRequestReversal,
}: {
  /** On a case: select transfers to save, reverse or copy. */
  caseId?: string;
  /** On a subscriber: the wallet’s history, read-only. */
  subscriberId?: string;
  now: number;
  onRequestReversal?: (transactions: Transaction[]) => void;
}) {
  const { data } = useApi<TransactionPage>(caseId ? `/cases/${caseId}/transactions` : `/subscribers/${subscriberId}/transactions`);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const rows = data.data;
  const chosen = rows.filter((t) => picked.has(t.id));
  const total = chosen.reduce((sum, t) => sum + t.amount.amount_minor, 0);
  const toRing = rows.filter((t) => /in FD-2998/.test(t.counterparty_note)).length;
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const range = () => {
    const times = chosen.map((t) => Date.parse(t.at)).sort();
    return `${formatClock(times[0])}-${formatClock(times[times.length - 1])}`;
  };

  const saveEvidence = async () => {
    setSaving(true);
    const title = `MoMo transfers ${range()}`;
    try {
      // TODO(api): proposed JSON form of POST /cases/{id}/evidence for transactions (files stay multipart).
      await apiFetch("POST", `/cases/${caseId}/evidence`, { title, transaction_ids: chosen.map((t) => t.id) });
      await mutate(`/cases/${caseId}/evidence`);
      await mutate(`/cases/${caseId}`);
      toast({
        tone: "success",
        title: `${chosen.length} transfers saved as evidence`,
        body: `“${title}” · visible on the Evidence tab.`,
        action: { label: "View", onClick: () => document.getElementById("tab-evidence")?.click() },
      });
      setPicked(new Set());
    } finally {
      setSaving(false);
    }
  };

  const copyRefs = async () => {
    await navigator.clipboard.writeText(chosen.map((t) => t.id).join("\n")).catch(() => undefined);
    toast({ title: `${chosen.length} references copied` });
  };

  const tiles = [
    { value: money(data.totals.out_since_swap?.amount_minor ?? 0), label: "out since SIM swap", tone: "critical" },
    { value: `${data.totals.flagged} of ${data.totals.total}`, label: "flagged by rules" },
    { value: String(toRing), label: "go to ring FD-2998" },
    { value: formatMoney(data.totals.balance.amount_minor, data.totals.balance.currency, { decimals: true }), label: "balance left" },
  ];

  return (
    <>
      <div className="flex gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn(
              "flex flex-1 flex-col gap-0.5 rounded-xl border px-4 py-3",
              t.tone === "critical" ? "border-critical-border bg-critical-bg" : "border-border-subtle bg-surface-base",
            )}
          >
            <span className={cn("text-h3", t.tone === "critical" ? "text-critical-fg" : "text-text-primary")}>{t.value}</span>
            <span className="text-caption text-text-secondary">{t.label}</span>
          </div>
        ))}
      </div>

      {caseId && chosen.length > 0 && (
        <div role="toolbar" aria-label="Selected transfers" className="flex items-center gap-3 rounded-xl bg-brand-ink px-4 py-2.5">
          <Checkbox label="Clear selection" hideLabel checked indeterminate={chosen.length < rows.length} onChange={() => setPicked(new Set())} />
          <p className="text-label-m text-text-inverse">
            {chosen.length} transfers selected · {money(total)}
          </p>
          <span className="flex-1" />
          {[
            ["Save as evidence", "app/icon-file-white-16", saveEvidence],
            ["Request reversal", "app/icon-refresh-white-16", () => onRequestReversal?.(chosen)],
            ["Copy references", "app/icon-copy-white-16", copyRefs],
          ].map(([label, icon, run]) => (
            <button
              key={label as string}
              type="button"
              disabled={saving}
              onClick={run as () => void}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-label-s text-text-inverse hover:bg-white/15"
            >
              <Icon name={icon as string} size={16} />
              {label as string}
            </button>
          ))}
          <button type="button" aria-label="Clear selection" onClick={() => setPicked(new Set())} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10">
            <Icon name="app/icon-x-lilac-18" size={18} />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
        <table className="w-full table-fixed text-left">
          <thead className="border-b border-border-subtle bg-surface-raised">
            <tr className="text-overline text-text-tertiary uppercase">
              <th className={cn("py-[11px] pl-5", caseId ? "w-[54px]" : "w-5")}>
                {caseId && <Checkbox
                  label="Select all transfers out"
                  hideLabel
                  checked={chosen.length > 0 && chosen.length === rows.filter((t) => t.direction === "out").length}
                  indeterminate={chosen.length > 0 && chosen.length < rows.filter((t) => t.direction === "out").length}
                  onChange={(e) => setPicked(e.target.checked ? new Set(rows.filter((t) => t.direction === "out").map((t) => t.id)) : new Set())}
                />}
              </th>
              <th className="w-[120px] py-[11px] font-bold">Time</th>
              <th className="w-[150px] py-[11px] font-bold">Reference</th>
              <th className="w-[150px] py-[11px] font-bold">Type</th>
              <th className="py-[11px] font-bold">Counterparty</th>
              <th className="w-[200px] py-[11px] font-bold">Recipient</th>
              <th className="w-[140px] py-[11px] pr-5 text-right font-bold">{data.totals.balance.currency}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const checked = picked.has(t.id);
              const when = formatWhen(t.at, now);
              return (
                <tr key={t.id} className={cn("relative border-b border-border-subtle last:border-b-0", checked ? "bg-brand-primary-subtle/60" : t.flagged ? "bg-surface-base" : "bg-surface-raised")}>
                  <td className="relative py-3 pl-5">
                    {lost(t) && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-critical-fg" title="Already cashed out" />}
                    {caseId && <Checkbox label={`Select ${t.id}`} hideLabel checked={checked} disabled={t.direction === "in"} onChange={(e) => toggle(t.id, e.target.checked)} />}
                  </td>
                  <td className="py-3 font-mono text-mono-s text-text-primary">
                    {when === formatClock(t.at) ? when : `${when === "Yesterday" ? "Yest." : when} ${when === "Yesterday" ? formatClock(t.at) : ""}`.trim()}
                  </td>
                  <td className="py-3 font-mono text-mono-s text-text-tertiary">{t.id}</td>
                  <td className="py-3 text-body-s text-text-primary">{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className={cn("py-3 font-mono text-mono-m", t.flagged ? "text-critical-fg" : "text-text-primary")}>{t.counterparty}</td>
                  <td className="py-3">
                    {t.counterparty_note ? (
                      <Badge label={t.counterparty_note.replace(", in ", " · in ")} tone={t.flagged ? "critical" : "neutral"} />
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className={cn("py-3 pr-5 text-right font-mono text-mono-m", t.flagged ? "text-critical-fg" : "text-text-primary")}>
                    {t.direction === "out" ? "-" : "+"}
                    {(t.amount.amount_minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
