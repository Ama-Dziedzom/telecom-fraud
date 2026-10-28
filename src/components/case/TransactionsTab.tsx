"use client";

import { Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/cases";
import { useApi, type TransactionPage } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { TZ, formatClock, formatMoney, formatWhen } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { StatTile, table } from "./parts";

const TYPE_LABEL: Record<string, string> = {
  agent_cash_out: "Agent cash-out",
  transfer: "Transfer",
  airtime: "Airtime",
  merchant: "Merchant",
  transfer_in: "Transfer in",
};

const money = (minor: number, currency = "GHS") => formatMoney(minor, currency);

/** Recipient pill: in another case, new, or known. Airtime to self has none. */
function recipient(t: Transaction) {
  if (t.counterparty_case_id) return { label: `In ${t.counterparty_case_id}`, tone: "critical" as const };
  if (t.counterparty_new) return { label: "New", tone: "critical" as const };
  if (t.type === "airtime") return null;
  return { label: "Known", tone: "neutral" as const };
}

/** C5 · Transactions — pick transfers to save as evidence, reverse or copy. Read-only on a subscriber. */
export function TransactionsTab({
  caseId,
  subscriberId,
  now,
  onRequestReversal,
  onOpenEvidence,
}: {
  /** On a case: select transfers to save, reverse or copy. */
  caseId?: string;
  /** On a subscriber: the wallet’s history, read-only. */
  subscriberId?: string;
  now: number;
  onRequestReversal?: (transactions: Transaction[]) => void;
  onOpenEvidence?: () => void;
}) {
  const { data } = useApi<TransactionPage>(caseId ? `/cases/${caseId}/transactions` : `/subscribers/${subscriberId}/transactions`);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[90px] w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  const rows = data.data;
  const outs = rows.filter((t) => t.direction === "out");
  const chosen = rows.filter((t) => picked.has(t.id));
  const total = chosen.reduce((sum, t) => sum + t.amount.amount_minor, 0);
  // The case most of the money went to (FD-2998 for Kojo), and how many transfers reached it.
  const ringCounts = rows.reduce<Record<string, number>>((m, t) => (t.counterparty_case_id ? { ...m, [t.counterparty_case_id]: (m[t.counterparty_case_id] ?? 0) + 1 } : m), {});
  const ring = Object.entries(ringCounts).sort((a, b) => b[1] - a[1])[0];
  const oldest = rows.reduce((m, t) => Math.min(m, Date.parse(t.at)), Infinity);
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
      await apiFetch("POST", `/cases/${caseId}/evidence`, { title, transaction_ids: chosen.map((t) => t.id) });
      await mutate(`/cases/${caseId}/evidence`);
      await mutate(`/cases/${caseId}`);
      toast({
        tone: "success",
        title: `${chosen.length} transfers saved as evidence`,
        body: `“${title}” is on the Evidence tab`,
        action: onOpenEvidence ? { label: "View", onClick: onOpenEvidence } : undefined,
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

  const when = (t: Transaction) => {
    const d = formatWhen(t.at, now);
    if (d === formatClock(t.at)) return d;
    // Within the week: “Mon 18:40”; older: “14 Oct”.
    const days = (now - Date.parse(t.at)) / 86_400_000;
    return days < 7 ? `${new Date(t.at).toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ })} ${formatClock(t.at)}` : d;
  };

  return (
    <>
      <div className="flex gap-3">
        <StatTile label="Money out" value={money(data.totals.out_since_swap?.amount_minor ?? data.totals.out?.amount_minor ?? 0)} sub={data.totals.out_since_swap ? "Since the SIM swap" : "In this window"} />
        <StatTile label="Flagged" value={`${data.totals.flagged} of ${data.totals.total}`} sub="By rules" />
        <StatTile label={ring ? `To ring ${ring[0]}` : "To a known ring"} value={String(ring?.[1] ?? 0)} sub="Transfers" />
        <StatTile label="Balance left" value={formatMoney(data.totals.balance.amount_minor, data.totals.balance.currency, { decimals: true })} sub="Now" />
      </div>

      {caseId && chosen.length > 0 && (
        <div role="toolbar" aria-label="Selected transfers" className="flex h-12 items-center gap-3 rounded-lg border border-brand-primary bg-brand-primary-subtle px-4">
          <Checkbox label="Clear selection" hideLabel checked indeterminate={chosen.length < outs.length} onChange={() => setPicked(new Set())} />
          <p className="flex items-baseline gap-2">
            <span className="text-label-s text-text-primary">
              {chosen.length} {chosen.length === 1 ? "transfer" : "transfers"} selected
            </span>
            <span className="text-caption text-text-secondary">{money(total)}</span>
          </p>
          <span className="flex-1" />
          <Button variant="secondary" size="sm" loading={saving} onClick={saveEvidence}>
            Save as evidence
          </Button>
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => onRequestReversal?.(chosen)}>
            Request reversal
          </Button>
          <Button variant="secondary" size="sm" disabled={saving} onClick={copyRefs}>
            Copy references
          </Button>
          <button type="button" aria-label="Clear selection" onClick={() => setPicked(new Set())} className="flex size-8 items-center justify-center rounded-lg hover:bg-brand-primary-subtle-hover">
            <Icon name="app/icon-x-primary-18" size={16} />
          </button>
        </div>
      )}

      <div className={table.wrap}>
        <table className="w-full table-fixed">
          <thead>
            <tr className={table.head}>
              {caseId && (
                <th className="w-12 pl-4">
                  <Checkbox
                    label="Select all transfers out"
                    hideLabel
                    checked={chosen.length > 0 && chosen.length === outs.length}
                    indeterminate={chosen.length > 0 && chosen.length < outs.length}
                    onChange={(e) => setPicked(e.target.checked ? new Set(outs.map((t) => t.id)) : new Set())}
                  />
                </th>
              )}
              <th className={cn("w-[110px] font-medium text-text-primary", !caseId && "pl-4")} aria-sort="descending">
                <span className="flex items-center gap-1">
                  Time
                  <Icon name="app/icon-chevron-down-16" size={14} />
                </span>
              </th>
              <th className="w-[150px] font-normal">Reference</th>
              <th className="w-[150px] font-normal">Type</th>
              <th className="font-normal">Counterparty</th>
              <th className="w-[180px] font-normal">Recipient</th>
              <th className="w-[140px] pr-4 text-right font-normal">{data.totals.balance.currency}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const checked = picked.has(t.id);
              const pill = recipient(t);
              return (
                <tr key={t.id} className={cn(table.row, "text-body-s text-text-primary", checked && "bg-brand-primary-subtle-hover hover:bg-brand-primary-subtle-hover")}>
                  {caseId && (
                    <td className="pl-4">
                      <Checkbox label={`Select ${t.id}`} hideLabel checked={checked} disabled={t.direction === "in"} onChange={(e) => toggle(t.id, e.target.checked)} />
                    </td>
                  )}
                  <td className={cn(!caseId && "pl-4")}>{when(t)}</td>
                  <td>{t.id}</td>
                  <td>{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="truncate pr-4">{t.counterparty}</td>
                  <td>{pill ? <Badge label={pill.label} tone={pill.tone} /> : <span className="text-text-tertiary">—</span>}</td>
                  <td className="pr-4 text-right tabular-nums">
                    {t.direction === "out" ? "-" : "+"}
                    {(t.amount.amount_minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={table.foot}>
          {rows.length} transactions{Number.isFinite(oldest) ? ` since ${new Date(oldest).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })}` : ""}
        </p>
      </div>
    </>
  );
}
