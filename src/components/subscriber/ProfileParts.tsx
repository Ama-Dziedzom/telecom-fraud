"use client";

import { Card } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import type { Subscriber } from "@/lib/api/fd";
import type { Revealed } from "@/lib/api/reveal";
import { useOutflow, useRecent } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatClock, formatDate, formatMoney, formatWhen } from "@/lib/time";
import Link from "next/link";
import { useState, type ReactNode } from "react";

const PII = "text-medium-fg";
const money = (m: { amount_minor: number; currency: string }, decimals = false) => formatMoney(m.amount_minor, m.currency, { decimals });
/** Where the latest swap happened (“Adum”), from the SIM history. */
const swapPlace = (sub: Subscriber) => sub.sim_history.find((h) => h.event === "sim_swap")?.place.split(", ")[0];

/** Risk score · Wallet · KYC · SIM · Device · Cases */
export function SummaryStrip({ sub, now }: { sub: Subscriber; now: number }) {
  const swapToday = sub.sim.last_swap_at && now - Date.parse(sub.sim.last_swap_at) < 86_400_000;
  const newDevice = now - Date.parse(sub.device.first_seen) < 86_400_000;
  const walletDown = sub.unavailable.includes("wallet");
  const open = sub.cases.filter((c) => c.status !== "closed").length;
  const cells: Array<[string, ReactNode]> = [
    [
      "Risk score",
      <span key="r" className="flex items-center gap-2">
        <span className="text-label-m text-critical-fg">{sub.risk_score}</span>
        <span className="h-1 w-[70px] rounded-[2px] bg-critical-bg">
          <span className="block h-1 rounded-[2px] bg-critical-fg" style={{ width: `${sub.risk_score}%` }} />
        </span>
      </span>,
    ],
    [
      "Wallet",
      <span key="w" className={walletDown ? "text-medium-fg" : undefined}>
        Tier {sub.wallet.tier} · {walletDown && sub.wallet_as_of ? `as of ${formatClock(sub.wallet_as_of)}` : money(sub.wallet.balance, true)}
      </span>,
    ],
    ["KYC", `Ghana Card · ${sub.kyc.nia_verified ? "verified" : "not verified"}`],
    ["SIM", <span key="s" className={swapToday ? "text-critical-fg" : undefined}>{swapToday ? `Swapped today ${formatClock(sub.sim.last_swap_at!)}` : `${sub.sim.age_months} months, no swaps`}</span>],
    ["Device", <span key="d" className={newDevice ? "text-critical-fg" : undefined}>{sub.device.model}{newDevice ? " · new" : ""}</span>],
    ["Cases", `${sub.cases.length} · ${open} open`],
  ];
  return (
    <div className="flex items-center rounded-xl border border-border-subtle bg-surface-base px-5 py-3.5">
      {cells.map(([label, value], i) => (
        <div key={label} className={cn("flex flex-1 flex-col gap-1.5 px-4", i < cells.length - 1 && "border-r border-border-subtle")}>
          <span className="text-caption text-text-secondary">{label}</span>
          <span className="text-body-m font-medium text-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function WhyHighRisk({ sub }: { sub: Subscriber }) {
  const reasons = sub.risk_reasons;
  return (
    <Card title="Why this subscriber is high-risk" icon="app/icon-zap-secondary-18" aside={<Badge label={`Score ${sub.risk_score}`} tone="critical" />}>
      <ul className="flex flex-col">
        {reasons.map((r) => (
          <li key={r.rule_id} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
            <span className="rounded-md bg-brand-primary-subtle px-1.5 py-px font-mono text-mono-s text-text-brand">{r.rule_id}</span>
            <span className="flex-1 text-body-s text-text-primary">{r.text}</span>
            <span className="text-label-s text-critical-fg">+{r.points}</span>
          </li>
        ))}
        {reasons.length === 0 && <li className="text-body-s text-text-secondary">No rule has fired on this subscriber.</li>}
      </ul>
      <Link href={`/subscribers/${sub.id}/behaviour`} className="w-fit text-label-s text-text-brand hover:underline">
        Compare normal vs now
      </Link>
    </Card>
  );
}

/** MoMo outflow · last N days — bars, today red, with the typical band underneath. */
export function OutflowChart({ id }: { id: string }) {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const { data } = useOutflow(id, Number(days));
  // Ordinary days are drawn against three times the typical maximum so they stay readable; today’s spike fills the chart.
  const scale = data ? data.typical.max.amount_minor * 3 : 1;
  const first = data?.days[0];
  return (
    <Card
      title={`MoMo outflow · last ${days} days`}
      icon="app/icon-chart-secondary-18"
      aside={
        <Segmented
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            { id: "7", label: "7d" },
            { id: "30", label: "30d" },
            { id: "90", label: "90d" },
          ]}
        />
      }
    >
      <div className="flex h-[120px] items-end gap-1" role="img" aria-label={`Money out per day for the last ${days} days`}>
        {data?.days.map((d, i) => {
          const today = i === data.days.length - 1;
          return (
            <span
              key={d.date}
              title={`${d.date}: ${money(d.amount)}`}
              className={cn("min-w-0 flex-1 rounded-[3px]", today ? "bg-critical-fg" : "bg-brand-primary-subtle")}
              style={{ height: today ? "120px" : `${Math.max(4, Math.min(1, d.amount.amount_minor / scale) * 120)}px` }}
            />
          );
        })}
      </div>
      {data && first && (
        <div className="flex justify-between text-caption">
          <span className="text-text-tertiary">{formatDate(first.date).replace(/ \d{4}$/, "")}</span>
          <span className="text-text-secondary">
            Typical day {money(data.typical.min).replace("GHS ", "GHS ")}-{money(data.typical.max).replace("GHS ", "")}
          </span>
          <span className="text-critical-fg">Today · {money(data.today)}</span>
        </div>
      )}
    </Card>
  );
}

export function RecentActivity({ id, now, total, onViewAll }: { id: string; now: number; total?: number; onViewAll: () => void }) {
  const { data } = useRecent(id);
  return (
    <Card
      title="Recent activity"
      icon="app/icon-activity-secondary-18"
      aside={
        <button type="button" onClick={onViewAll} className="rounded text-label-s text-text-brand hover:underline">
          View all {total ?? ""}
        </button>
      }
    >
      <ul className="flex flex-col">
        {data?.data.map((e, i) => (
          <li key={i} className="flex items-center gap-3 py-[9px]">
            <span className={cn("size-2 shrink-0 rounded-full", e.flagged ? "bg-critical-fg" : "bg-border-strong")} />
            <span className="w-[110px] shrink-0 font-mono text-mono-s text-text-secondary">
              {e.until ? `${formatClock(e.at)}-${formatClock(e.until)}` : formatWhen(e.at, now, { withTime: false })}
              {formatWhen(e.at, now) === "Yesterday" ? ` ${formatClock(e.at)}` : ""}
            </span>
            <span className={cn("text-body-s", e.flagged ? "text-text-primary" : "text-text-secondary")}>{e.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function IdentityCard({ sub, revealed, onReveal, onHide }: { sub: Subscriber; revealed: Revealed | null; onReveal: () => void; onHide: () => void }) {
  return (
    <Card
      title="Identity · KYC"
      icon="app/icon-user-secondary-18"
      aside={
        <button type="button" onClick={revealed ? onHide : onReveal} className="rounded text-label-s text-text-brand hover:underline">
          {revealed ? "Hide" : "Reveal"}
        </button>
      }
    >
      <KeyValueList
        rows={[
          ["Name on wallet", revealed?.values.name ? <span key="n" className={PII}>{revealed.values.name}</span> : `${sub.name} (masked)`],
          ["ID", revealed?.values.ghana_card ? <span key="i" className={PII}>{revealed.values.ghana_card}</span> : `Ghana Card · ${sub.kyc.ghana_card.replace(/\*+/, "…")}`],
          ["Verified", `${formatDate(sub.kyc.verified_at)}${sub.kyc.branch ? ` · ${sub.kyc.branch}` : ""}`],
          ["Date of birth", revealed?.values.date_of_birth ? <span key="d" className={PII}>{formatDate(revealed.values.date_of_birth)}</span> : sub.kyc.date_of_birth],
          ["Alternate number", revealed?.values.alt_msisdn ? <span key="a" className={PII}>{revealed.values.alt_msisdn}</span> : sub.contact.alt_msisdn],
        ]}
      />
    </Card>
  );
}

export function SimDeviceCard({ sub, now }: { sub: Subscriber; now: number }) {
  const swapToday = sub.sim.last_swap_at && now - Date.parse(sub.sim.last_swap_at) < 86_400_000;
  const newDevice = now - Date.parse(sub.device.first_seen) < 86_400_000;
  return (
    <Card title="SIM & device" icon="app/icon-sim-18">
      <KeyValueList
        rows={[
          ["SIM (ICCID)", sub.sim.iccid],
          ["SIM age", swapToday ? <span key="s" className="text-critical-fg">Swapped today {formatClock(sub.sim.last_swap_at!)}</span> : `${sub.sim.age_months} months`],
          ["Swap agent", sub.sim.swap_agent ? [sub.sim.swap_agent, swapPlace(sub)].filter(Boolean).join(" · ") : "—"],
          ["Device now", <span key="d" className={newDevice ? "text-critical-fg" : undefined}>{sub.device.model}{newDevice ? ` · since ${formatClock(sub.device.first_seen)}` : ""}</span>],
          ["Usual device", `${sub.device.usual_model} · ${sub.device.usual_months} months`],
        ]}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href={`/subscribers/${sub.id}/sim-check`} className="text-label-s text-text-brand hover:underline">
          SIM duplication check
        </Link>
        <Link href={`/subscribers/${sub.id}/device-check`} className="text-label-s text-text-brand hover:underline">
          Device check
        </Link>
      </div>
    </Card>
  );
}

export function MobileMoneyCard({ sub, onRetry }: { sub: Subscriber; onRetry: () => void }) {
  if (sub.unavailable.includes("wallet")) {
    return (
      <Card title="Mobile money" icon="app/icon-wallet-18" className="border-medium-border">
        <EmptyState icon="app/icon-wifi-off-medium-22" tone="medium" size="md" title="Couldn’t reach the MoMo service" className="border-0 px-2 py-4">
          Balance, limits and recipients aren’t shown. Tried 3 times{sub.wallet_last_try ? ` · last at ${formatClock(sub.wallet_last_try)}` : ""}.
        </EmptyState>
        <div className="-mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }
  const w = sub.wallet;
  return (
    <Card title="Mobile money" icon="app/icon-wallet-18">
      <KeyValueList
        rows={[
          ["Wallet", `Tier ${w.tier} · limit ${money(w.daily_limit).replace(",000", "k")}/day`],
          ["Status", <span key="s" className={w.status === "frozen" ? "text-critical-fg" : undefined}>{w.status === "frozen" ? `Frozen${w.frozen_at ? ` ${formatClock(w.frozen_at)}` : ""}${w.frozen_by ? ` by ${w.frozen_by.name.split(" ")[0]}` : ""}` : "Active"}</span>],
          ["Balance", money(w.balance, true)],
          ["Usual recipients", String(w.usual_recipients)],
          ["New recipients today", <span key="n" className={w.new_recipients_today ? "text-critical-fg" : undefined}>{w.new_recipients_today}</span>],
        ]}
      />
      <Link href={`/subscribers/${sub.id}/patterns`} className="text-label-s text-text-brand hover:underline">
        Transaction patterns
      </Link>
    </Card>
  );
}

export { PII };
