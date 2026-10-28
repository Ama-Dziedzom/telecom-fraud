"use client";

import { Card, Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  useAlertTransactions,
  useDevices,
  useSubscriber,
  useSubscriberActivity,
  type AlertDetail,
  type AlertStep,
  type Money,
} from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatDate, formatMoney, formatWhen } from "@/lib/time";
import type { ReactNode } from "react";

// ─── Shared pieces ────────────────────────────────────────────────────────

/** Stat tile — Caption label, H2 value, Caption sub-line; `brand` when the value links somewhere (a case). */
export function Glance({
  label,
  value,
  sub,
  brand,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  brand?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border-default bg-surface-raised px-4 py-3.5">
      <span className="text-caption text-text-tertiary">{label}</span>
      <span className={cn("truncate text-h2", brand ? "text-text-brand" : "text-text-primary")}>{value}</span>
      {sub && <span className="truncate text-caption text-text-tertiary">{sub}</span>}
    </div>
  );
}

const money = (m: Money | undefined) => (m ? formatMoney(m.amount_minor, m.currency) : "–");

function TabSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-3 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Timeline dot: loss (red), risk (amber) or neutral (hollow). */
type Dot = "loss" | "risk" | "neutral";

/** Timeline — time on the left (right-aligned), a dot, then the event and its source line. */
function Timeline({
  items,
  timeWidth = 48,
}: {
  items: Array<{ key: string; when: string; dot: Dot; title: ReactNode; sub?: ReactNode }>;
  timeWidth?: number;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it) => (
        <li key={it.key} className="flex items-start gap-3">
          <span style={{ width: timeWidth }} className="shrink-0 pt-px text-right text-caption text-text-tertiary">
            {it.when}
          </span>
          <Icon name={`app/timeline-dot-${it.dot}-10`} size={10} className="mt-[5px] shrink-0" />
          <div className="flex min-w-0 flex-col pl-1.5">
            <p className="text-body-s text-text-primary">{it.title}</p>
            {it.sub && <p className="text-body-s text-text-secondary">{it.sub}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────

/** Where the money or the evidence is: shown as a loss; other signals are a risk. */
const LOSS_STEPS = new Set(["payments_out", "wallets_paid", "recipients", "network", "pin"]);
const stepDot = (step: AlertStep, moneyOut: Money | null): Dot =>
  LOSS_STEPS.has(step.kind) || (!!moneyOut && step.amount?.amount_minor === moneyOut.amount_minor) ? "loss" : "risk";

/** B4 · What happened — the alert’s story, oldest first. */
export function WhatHappened({ steps, moneyOut, now }: { steps: AlertStep[]; moneyOut: Money | null; now: number }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-label-m text-text-primary">What happened</h3>
      <Timeline
        items={steps.map((step, i) => ({
          key: String(i),
          when: formatWhen(step.at, now),
          dot: stepDot(step, moneyOut),
          title: step.label,
          sub: step.detail,
        }))}
      />
    </section>
  );
}

/** Rule chips — rule ID + name, points in tertiary. */
export function RulesRow({ rules }: { rules: AlertDetail["rules_fired"] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-text-tertiary">Rules</span>
      {rules.map((r) => (
        <span key={r.id} className="flex h-6 items-center gap-1.5 rounded border border-border-default bg-surface-base px-2 text-caption">
          <span className="font-medium text-text-primary">
            {r.id} {r.name}
          </span>
          <span className="text-text-tertiary">+{r.points}</span>
        </span>
      ))}
    </div>
  );
}

/** Suggested action — “Add to FD-3047” when the alert matches an open case. */
export function Recommendation({
  suggestion,
  onAttach,
  onProtect,
  busy,
}: {
  suggestion: NonNullable<AlertDetail["suggested_case"]>;
  onAttach: () => void;
  onProtect: () => void;
  busy: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-caption text-text-tertiary">Suggested</p>
        <p className="text-label-m text-text-primary">Add to {suggestion.case_id}</p>
        <p className="text-body-s text-text-secondary">{suggestion.why}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onAttach} loading={busy}>
          Add to {suggestion.case_id}
        </Button>
        <Button variant="ghost" size="sm" onClick={onProtect}>
          Freeze wallet first
        </Button>
      </div>
    </section>
  );
}

// ─── Activity ─────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = { momo: "MoMo", network: "Network", crm: "CRM", person: "Analyst", system: "System" };
const LOSS_EVENTS = new Set(["opened", "payment"]);
const QUIET_EVENTS = new Set(["kyc", "normal"]);

/** B5 · Activity — everything the subscriber did, newest first. */
export function ActivityTab({ subscriberId, now }: { subscriberId: string; now: number }) {
  const { data, isLoading } = useSubscriberActivity(subscriberId);
  if (isLoading || !data) return <TabSkeleton />;
  return (
    <Timeline
      timeWidth={52}
      items={data.data.map((e) => ({
        key: e.id,
        when: formatWhen(e.at, now),
        dot: LOSS_EVENTS.has(e.kind) ? "loss" : QUIET_EVENTS.has(e.kind) ? "neutral" : "risk",
        title: e.title,
        sub: [SOURCE_LABEL[e.source] ?? e.source, e.actor?.name].filter(Boolean).join(" · "),
      }))}
    />
  );
}

// ─── Transactions ─────────────────────────────────────────────────────────

/** B6 · Transactions — money out, new recipients, balance left, then every transfer. */
export function TransactionsTab({ alertId }: { alertId: string }) {
  const { data, isLoading } = useAlertTransactions(alertId);
  if (isLoading || !data) return <TabSkeleton rows={6} />;
  const { totals } = data;
  const first = data.data.at(-1);
  const toNew = data.data.filter((t) => t.counterparty_new).length;
  return (
    <>
      <div className="flex gap-3">
        <Glance
          label="Money out"
          value={money(totals.out ?? totals.out_since_swap)}
          sub={totals.window_minutes ? `In ${totals.window_minutes} min` : undefined}
        />
        <Glance label="New recipients" value={`${toNew} of ${totals.total}`} sub="Never paid before" />
        <Glance
          label="Balance left"
          value={formatMoney(totals.balance.amount_minor, totals.balance.currency, { decimals: true })}
          sub="After the last transfer"
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-lg border border-border-default">
          <table className="w-full table-fixed">
            <thead className="border-b border-border-default bg-surface-raised">
              <tr className="text-caption text-text-secondary">
                <th scope="col" aria-sort="descending" className="h-10 w-[68px] pl-4 text-left font-medium text-text-primary">
                  <span className="flex items-center gap-1">
                    Time
                    <Icon name="app/icon-sort-desc-primary-14" size={14} />
                  </span>
                </th>
                <th scope="col" className="h-10 px-4 text-left font-normal">
                  To wallet
                </th>
                <th scope="col" className="h-10 w-[140px] px-4 text-left font-normal">
                  Recipient
                </th>
                <th scope="col" className="h-10 w-[110px] pr-4 text-right font-normal">
                  {totals.balance.currency} {first?.direction === "in" ? "in" : "out"}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((t) => {
                const recipient = t.counterparty_new
                  ? { label: "New", tone: "high" as const }
                  : t.counterparty_case_id
                    ? { label: `In ${t.counterparty_case_id}`, tone: "brand" as const }
                    : { label: "Known", tone: "neutral" as const };
                return (
                  <tr key={t.id} className="h-[45px] border-b border-border-default text-body-s text-text-primary">
                    <td className="pl-4">{formatClock(t.at)}</td>
                    <td className="truncate px-4">{t.counterparty}</td>
                    <td className="px-4">
                      <Badge label={recipient.label} tone={recipient.tone} />
                    </td>
                    <td className="pr-4 text-right tabular-nums">
                      {t.direction === "in" ? "+" : ""}
                      {(t.amount.amount_minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="flex h-14 items-center px-4 text-body-s text-text-secondary">
            {data.data.length} {data.data.length === 1 ? "transfer" : "transfers"}
            {first ? ` since ${formatClock(first.at)}` : ""}
          </p>
        </div>
        <p className="text-caption text-text-tertiary">Earlier history is on the subscriber profile.</p>
      </div>
    </>
  );
}

// ─── KYC & SIM ────────────────────────────────────────────────────────────

/** Key–value rows: Body/S key secondary, Body/S value primary, dividers. */
function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 border-b border-border-default py-2 last:border-b-0">
          <dt className="text-body-s text-text-secondary">{k}</dt>
          <dd className="text-right text-body-s text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** B7 · KYC & SIM — who owns the wallet, and every SIM and device it has seen. */
export function KycTab({ subscriberId, now }: { subscriberId: string; now: number }) {
  const { data: sub, isLoading } = useSubscriber(subscriberId);
  const { data: devices } = useDevices(subscriberId);
  if (isLoading || !sub) return <TabSkeleton rows={4} />;

  const day = 86_400_000;
  const swappedRecently = sub.sim.last_swap_at && now - Date.parse(sub.sim.last_swap_at) < 7 * day;
  const newDevice = devices?.data.find((d) => now - Date.parse(d.first_seen) < day);
  const when = (iso: string) => (formatWhen(iso, now) === formatClock(iso) ? "Today" : formatWhen(iso, now));

  const history = [
    ...(devices?.data ?? []).map((d) => {
      const isNew = now - Date.parse(d.first_seen) < day;
      const months = Math.max(1, Math.round((Date.parse(d.last_seen) - Date.parse(d.first_seen)) / (30 * day)));
      return {
        at: d.first_seen,
        key: `d:${d.imei}`,
        dot: (isNew ? "risk" : "neutral") as Dot,
        title: `${d.model} · IMEI ${d.imei}`,
        sub: [
          isNew ? "New: never used with this SIM before" : `Used for ${months} ${months === 1 ? "month" : "months"}`,
          d.eir_status !== "ok" && `IMEI check: ${d.eir_status.replace(/_/g, " ")}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }),
    ...sub.sim_history.map((s, i) => ({
      at: s.at,
      key: `s:${i}`,
      dot: (s.event === "sim_swap" ? "loss" : "neutral") as Dot,
      title: s.event === "sim_swap" ? "SIM swapped" : sub.sim.last_swap_at ? "SIM issued" : "SIM issued, no swaps since",
      sub: [s.place, s.agent && `agent ${s.agent}`].filter(Boolean).join(" · "),
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <>
      {swappedRecently ? (
        <Banner tone="error" title={`SIM swapped ${formatWhen(sub.sim.last_swap_at!, now, { withTime: true })}`}>
          {sub.sim.swap_agent ? `At agent ${sub.sim.swap_agent}. ` : ""}Check the swap before anything else.
        </Banner>
      ) : newDevice ? (
        <Banner tone="info" title="No SIM swap, but a new device">
          Points to a stolen or cloned phone, or an insider using the PIN.
        </Banner>
      ) : null}

      <Card title="KYC">
        <Facts
          rows={[
            ["Name on wallet", `${sub.name} (masked)`],
            ["ID", `Ghana Card ${sub.kyc.ghana_card} (masked)`],
            [
              "Verified",
              sub.kyc.nia_verified ? `${formatDate(sub.kyc.verified_at)}${sub.kyc.branch ? ` · ${sub.kyc.branch}` : ""}` : "Not verified",
            ],
            ["Date of birth", sub.kyc.date_of_birth_matches ? "Matches ID" : "Doesn’t match ID"],
            ["Registered address", sub.kyc.address],
          ]}
        />
      </Card>

      <Card title="SIM and device history">
        <Timeline
          timeWidth={52}
          items={history.map((h) => ({ key: h.key, when: when(h.at), dot: h.dot, title: h.title, sub: h.sub }))}
        />
      </Card>
    </>
  );
}
