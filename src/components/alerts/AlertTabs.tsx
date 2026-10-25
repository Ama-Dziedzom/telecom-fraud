"use client";

import { Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import {
  useAlertTransactions,
  useDevices,
  useSubscriber,
  useSubscriberActivity,
  type AlertDetail,
  type Money,
} from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatDate, formatMoney, formatWhen } from "@/lib/time";
import type { ReactNode } from "react";

// ─── Shared pieces ────────────────────────────────────────────────────────

const GLANCE_TONES = {
  critical: "bg-critical-bg text-critical-fg",
  high: "bg-high-bg text-high-fg",
  medium: "bg-medium-bg text-medium-fg",
  brand: "bg-brand-primary-subtle text-text-brand",
  neutral: "bg-surface-raised text-text-primary",
};

/** “At a glance” tile: overline label + Title value on a tinted card. */
export function Glance({ label, value, tone }: { label: string; value: ReactNode; tone: keyof typeof GLANCE_TONES }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] px-3.5 py-3", GLANCE_TONES[tone])}>
      <span className="text-overline text-text-tertiary uppercase">{label}</span>
      <span className="truncate text-title">{value}</span>
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

// ─── Summary ──────────────────────────────────────────────────────────────

const STEP_STYLE: Record<string, { icon: string; tile: string }> = {
  new_device: { icon: "app/icon-phone-high-18", tile: "bg-high-bg" },
  payments_out: { icon: "app/icon-send-brand-18", tile: "bg-brand-primary-subtle" },
  recipients: { icon: "app/icon-users-critical-18", tile: "bg-critical-bg" },
  network: { icon: "app/icon-network-critical-18", tile: "bg-critical-bg" },
  calls: { icon: "app/icon-phone-high-18", tile: "bg-high-bg" },
  pin: { icon: "app/icon-shield-critical-18", tile: "bg-critical-bg" },
  sim_swap: { icon: "app/icon-sim-18", tile: "bg-surface-sunken" },
  sim: { icon: "app/icon-sim-18", tile: "bg-surface-sunken" },
  crm: { icon: "app/icon-message-18", tile: "bg-surface-sunken" },
};

/** Vertical story: icon tile on a rail, time + label, detail below. */
export function WhatHappened({ steps, now }: { steps: AlertDetail["what_happened"]; now: number }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-title text-text-primary">
        <Icon name="app/icon-history-18" size={18} />
        What happened
      </h3>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const style = STEP_STYLE[step.kind] ?? STEP_STYLE.crm;
          const critical = step.tone === "critical";
          return (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("flex size-9 items-center justify-center rounded-[10px]", style.tile)}>
                  <Icon name={style.icon} size={18} />
                </span>
                {i < steps.length - 1 && (
                  <span aria-hidden className={cn("h-7 w-0.5", critical ? "bg-critical-border" : "bg-border-default")} />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex items-center gap-2">
                  <span className="font-mono text-mono-s text-text-tertiary">{formatWhen(step.at, now)}</span>
                  <span className="text-label-m text-text-primary">{step.label}</span>
                </p>
                <p className={cn("text-body-s", critical ? "text-critical-fg" : "text-text-secondary")}>{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function RulesRow({ rules }: { rules: AlertDetail["rules_fired"] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-overline text-text-tertiary uppercase">Rules</span>
      {rules.map((r) => (
        <Badge key={r.id} label={`${r.id} ${r.name} +${r.points}`} tone="neutral" />
      ))}
    </div>
  );
}

/** “Add to FD-3047” — the recommended next step when the alert matches an open case. */
export function Recommendation({
  suggestion,
  onAttach,
  onProtect,
  busy,
  locked,
}: {
  suggestion: NonNullable<AlertDetail["suggested_case"]>;
  onAttach: () => void;
  onProtect: () => void;
  busy: boolean;
  locked: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-brand-primary bg-brand-primary-subtle px-[18px] py-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-primary-subtle">
          <Icon name="app/icon-folder-brand-20" size={20} />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-h3 text-text-primary">Add to {suggestion.id}</p>
          <p className="text-body-s text-text-secondary">{suggestion.reason}</p>
        </div>
      </div>
      {!locked && (
        <div className="flex gap-2">
          <Button size="md" onClick={onAttach} loading={busy} iconLeft={<Icon name="app/icon-plus-white-18" size={18} />}>
            Add to {suggestion.id}
          </Button>
          <Button variant="secondary" size="md" onClick={onProtect} iconLeft={<Icon name="app/icon-shield-primary-18" size={18} />}>
            Protect wallet first
          </Button>
        </div>
      )}
    </section>
  );
}

// ─── Activity ─────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = { momo: "MoMo", network: "Network", crm: "CRM", person: "Analyst" };
const KIND_DOT: Record<string, string> = {
  alert: "bg-critical-fg",
  device: "bg-medium-fg",
  kyc: "bg-success-fg",
};

export function ActivityTab({ subscriberId, now }: { subscriberId: string; now: number }) {
  const { data, isLoading } = useSubscriberActivity(subscriberId);
  if (isLoading || !data) return <TabSkeleton />;
  return (
    <ol className="relative flex flex-col gap-5 pl-7">
      <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-0.5 bg-border-default" />
      {data.data.map((e) => (
        <li key={e.id} className="relative flex flex-col gap-1">
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 -left-7 size-3 rounded-full border-2 border-surface-base",
              KIND_DOT[e.kind] ?? "bg-border-strong",
            )}
          />
          <p className="flex items-center gap-2">
            <span className="font-mono text-mono-s text-text-tertiary">{formatWhen(e.at, now)}</span>
            <Badge label={SOURCE_LABEL[e.source] ?? e.source} tone={e.kind === "alert" ? "critical" : "neutral"} />
          </p>
          <p className="text-body-m text-text-primary">{e.title}</p>
          {e.detail && <p className="text-caption text-text-secondary">{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

// ─── Transactions ─────────────────────────────────────────────────────────

export function TransactionsTab({ alertId }: { alertId: string }) {
  const { data, isLoading } = useAlertTransactions(alertId);
  if (isLoading || !data) return <TabSkeleton rows={6} />;
  const { totals } = data;
  const first = data.data.at(-1);
  return (
    <>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-0.5 rounded-xl border border-critical-border bg-critical-bg px-4 py-3">
          <span className="text-h3 text-critical-fg">{money(totals.out ?? totals.out_since_swap)}</span>
          <span className="text-caption text-text-secondary">
            out{totals.window_minutes ? ` in ${totals.window_minutes} min` : ""}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 rounded-xl border border-border-default px-4 py-3">
          <span className="text-h3 text-text-primary">
            {totals.flagged} of {totals.total}
          </span>
          <span className="text-caption text-text-secondary">to new recipients</span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 rounded-xl border border-border-default px-4 py-3">
          <span className="text-h3 text-text-primary">
            {formatMoney(totals.balance.amount_minor, totals.balance.currency, { decimals: true })}
          </span>
          <span className="text-caption text-text-secondary">balance left</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border-default">
        <table className="w-full text-left">
          <thead className="border-b border-border-subtle bg-surface-raised">
            <tr className="text-overline text-text-tertiary uppercase">
              <th className="py-[11px] pl-[18px] font-bold">Time</th>
              <th className="py-[11px] pl-4 font-bold">To wallet</th>
              <th className="py-[11px] pl-4 font-bold">Recipient</th>
              <th className="py-[11px] pr-[18px] pl-4 text-right font-bold">{totals.balance.currency}</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((t) => {
              const isNew = t.counterparty_note.startsWith("New");
              return (
                <tr key={t.id} className="border-b border-border-subtle last:border-b-0">
                  <td className="py-2.5 pl-[18px] font-mono text-mono-s text-text-primary">{formatClock(t.at)}</td>
                  <td className={cn("py-2.5 pl-4 font-mono text-mono-s", isNew ? "text-critical-fg" : "text-text-secondary")}>
                    {t.counterparty}
                  </td>
                  <td className="py-2.5 pl-4">
                    <Badge label={isNew ? "New recipient" : "Known"} tone={isNew ? "critical" : "neutral"} />
                  </td>
                  <td
                    className={cn(
                      "py-2.5 pr-[18px] pl-4 text-right font-mono text-mono-m",
                      isNew ? "text-critical-fg" : "text-text-primary",
                    )}
                  >
                    {t.direction === "out" ? "-" : "+"}
                    {(t.amount.amount_minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {first && (
        <p className="flex items-center gap-2 text-caption text-text-secondary">
          <Icon name="icon-info-secondary" size={14} />
          Showing transfers since {formatClock(first.at)}. Earlier history is on the subscriber profile.
        </p>
      )}
    </>
  );
}

// ─── KYC & SIM ────────────────────────────────────────────────────────────

export function KycTab({ subscriberId, now }: { subscriberId: string; now: number }) {
  const { data: sub, isLoading } = useSubscriber(subscriberId);
  const { data: devices } = useDevices(subscriberId);
  if (isLoading || !sub) return <TabSkeleton rows={4} />;

  const day = 86_400_000;
  const swappedRecently = sub.sim.last_swap_at && now - Date.parse(sub.sim.last_swap_at) < 7 * day;
  const newDevice = devices?.data.find((d) => d.kind !== "sim" && now - Date.parse(d.first_seen) < day);

  return (
    <>
      {swappedRecently ? (
        <Banner tone="error" title={`SIM swapped ${formatWhen(sub.sim.last_swap_at!, now, { withTime: true })}`}>
          {sub.sim.swap_agent ? `At agent ${sub.sim.swap_agent}. ` : ""}Check the swap before anything else.
        </Banner>
      ) : newDevice ? (
        <Banner tone="info" title="No SIM swap: but a new device">
          This looks more like a stolen or cloned phone, or an insider using the PIN, than a SIM swap.
        </Banner>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-border-subtle px-[18px] py-4">
        <h3 className="flex items-center gap-2 text-title text-text-primary">
          <Icon name="app/icon-user-secondary-16" size={18} />
          KYC
        </h3>
        <KeyValueList
          rows={[
            ["Name on wallet", `${sub.name} (masked)`],
            ["ID", `Ghana Card · ${sub.kyc.ghana_card} (masked)`],
            [
              "Verified",
              sub.kyc.nia_verified
                ? `${formatDate(sub.kyc.verified_at)}${sub.kyc.branch ? ` · ${sub.kyc.branch}` : ""}`
                : "Not verified",
            ],
            ...(sub.kyc.dob_matches !== undefined
              ? [["Date of birth", sub.kyc.dob_matches ? "Matches ID" : "Doesn’t match ID"] as [string, string]]
              : []),
            ...(sub.kyc.address ? [["Registered address", sub.kyc.address] as [string, string]] : []),
            ["Wallet", `Tier ${sub.wallet.tier} · customer since ${formatDate(sub.customer_since)}`],
          ]}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border-subtle px-[18px] py-4">
        <h3 className="flex items-center gap-2 text-title text-text-primary">
          <Icon name="app/icon-sim-18" size={18} />
          SIM &amp; device history
        </h3>
        <ol className="relative flex flex-col gap-4 pl-6">
          <span aria-hidden className="absolute top-2 bottom-2 left-[4px] w-0.5 bg-border-default" />
          {(devices?.data ?? []).map((d, i) => {
            const isNew = now - Date.parse(d.first_seen) < day;
            const isSim = d.kind === "sim";
            return (
              <li key={i} className="relative flex flex-col gap-1">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 -left-6 size-2.5 rounded-full",
                    isNew ? "bg-medium-fg" : isSim ? "bg-success-fg" : "bg-border-strong",
                  )}
                />
                <p className="flex items-center gap-2">
                  <span className="font-mono text-mono-s text-text-tertiary">{formatWhen(d.first_seen, now, { withTime: true })}</span>
                  <Badge label={isSim ? "SIM" : "Device"} tone="neutral" />
                </p>
                <p className="text-body-m text-text-primary">{isSim ? d.model : `${d.model} · IMEI ${d.imei}`}</p>
                {d.note && <p className="text-caption text-text-secondary">{d.note}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
