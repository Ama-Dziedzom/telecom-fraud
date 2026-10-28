"use client";

import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { CaseStatusBadge, riskTone } from "@/components/app/indicators";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { Subscriber } from "@/lib/api/fd";
import type { Revealed } from "@/lib/api/reveal";
import { useOutflow, useRecent, type RecentEvent } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatClock, formatDate, formatMoney, formatSpan, formatWhen, TZ } from "@/lib/time";
import Link from "next/link";
import type { ReactNode } from "react";

export const money = (m: { amount_minor: number; currency: string }, decimals = false) => formatMoney(m.amount_minor, m.currency, { decimals });
/** “Aug 2023” */
export const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: TZ });
/** “+233 54 *** 3457” → “054 *** 3457”, the way analysts read Ghanaian numbers. */
export const localNumber = (msisdn: string) => msisdn.replace(/^\+233\s?(\d)/, "0$1");
/** Where the latest swap happened (“Adum”), from the SIM history. */
const swapPlace = (sub: Subscriber) => sub.sim_history.find((h) => h.event === "sim_swap")?.place.split(", ")[0];
const isToday = (iso: string | null, now: number) => !!iso && formatWhen(iso, now, { withTime: true }).startsWith("Today");

/* ───────────────────────── Foundations pieces ───────────────────────── */

/** Foundations · Stat tile (1319:167771) — raised, radius 8; Caption label, H2 value, tertiary delta line. */
export function StatTile({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border-default bg-surface-raised p-4", className)}>
      <span className="truncate text-caption text-text-secondary">{label}</span>
      <span className="truncate text-h2 text-text-primary">{value}</span>
      {sub && <span className="truncate text-caption text-text-tertiary">{sub}</span>}
    </div>
  );
}

/** Stat tile placeholder (C17 / C20). */
export function StatTileSkeleton() {
  return (
    <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border-default bg-surface-raised p-4">
      <Skeleton className="h-2.5 w-14" />
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-2.5 w-24" />
    </div>
  );
}

/** Card placeholder — title bar and three lines (C17 / C20). */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-3 rounded-lg border border-border-default bg-surface-base px-6 py-5", className)}>
      <Skeleton className="mb-3 h-3 w-36" />
      <Skeleton className="h-2.5 w-[70%] max-w-[360px]" />
      <Skeleton className="h-2.5 w-[60%] max-w-[300px]" />
      <Skeleton className="h-2.5 w-[45%] max-w-[230px]" />
    </div>
  );
}

/** Foundations · Detail row (1333:178942) — key secondary left, value primary right, hairline under (none on the last). */
export function DetailRows({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex h-10 items-start gap-4 border-b border-border-default py-2.5 text-body-s last:border-b-0">
          <dt className="min-w-0 flex-1 text-text-secondary">{k}</dt>
          <dd className="shrink-0 text-right whitespace-nowrap text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Foundations · Party row (1335:192955) — name + role, then a value or a pill. */
export function PartyRow({ title, sub, aside, href }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode; href?: string }) {
  return (
    <li className="flex h-[52px] items-center gap-3 border-b border-border-default py-2 last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col">
        {href ? (
          <Link href={href} className="w-fit truncate text-label-s text-text-primary hover:underline">
            {title}
          </Link>
        ) : (
          <span className="truncate text-label-s text-text-primary">{title}</span>
        )}
        {sub && <span className="truncate text-caption text-text-secondary">{sub}</span>}
      </span>
      {aside}
    </li>
  );
}

export type TimelineTone = "neutral" | "risk" | "loss";
const DOT: Record<TimelineTone, string> = {
  neutral: "app/timeline-dot-neutral-10",
  risk: "app/timeline-dot-risk-10",
  loss: "app/timeline-dot-loss-10",
};

/**
 * Foundations · Timeline (1319:167720) — time (56), dot on a 1px line, title
 * and detail. Risk = amber (device or SIM change), Loss = red (money leaving).
 */
export function Timeline({ events }: { events: Array<{ key: string; time: string; tone: TimelineTone; title: ReactNode; detail?: ReactNode }> }) {
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => (
        <li key={e.key} className="flex gap-3">
          <span className="w-14 shrink-0 text-right text-caption text-text-tertiary">{e.time}</span>
          <span aria-hidden className="flex w-3 shrink-0 flex-col items-center gap-1 pt-1">
            <Icon name={DOT[e.tone]} size={10} />
            {i < events.length - 1 && <span className="w-px flex-1 bg-border-default" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
            <span className="text-label-s text-text-primary">{e.title}</span>
            {e.detail && <span className="text-body-s text-text-secondary">{e.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────────────── C12 · overview ───────────────────────── */

const RISK_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;

/** C12 · Risk score · Wallet · KYC · SIM · Device, as five stat tiles. C16: a source that didn’t answer says so. */
export function SubscriberTiles({ sub, now }: { sub: Subscriber; now: number }) {
  const walletDown = sub.unavailable.includes("wallet");
  const kycDown = sub.unavailable.includes("kyc");
  const swapToday = isToday(sub.sim.last_swap_at, now);
  const newDevice = isToday(sub.device.first_seen, now);
  const w = sub.wallet;
  const rules = sub.risk_reasons.length;
  return (
    <div className="flex gap-3">
      <StatTile label="Risk score" value={sub.risk_score} sub={`${RISK_LABEL[riskTone(sub.risk_score)]} · ${rules} ${rules === 1 ? "rule" : "rules"}`} />
      <StatTile
        label="Wallet"
        value={walletDown ? "Not available" : money(w.balance, true)}
        sub={
          walletDown
            ? sub.wallet_last_try
              ? `MoMo timed out ${formatClock(sub.wallet_last_try)}`
              : "MoMo didn’t respond"
            : `Tier ${w.tier} · ${w.status === "frozen" ? `frozen${w.frozen_at ? ` ${formatClock(w.frozen_at)}` : ""}` : "active"}`
        }
      />
      <StatTile
        label="KYC"
        value={kycDown ? "Not available" : sub.kyc.nia_verified ? "Verified" : "Not verified"}
        // TODO(api): 0.2 doesn’t say when the KYC registry timed out (C16).
        sub={kycDown ? "Registry didn’t respond" : `Ghana Card · ${monthYear(sub.kyc.verified_at)}`}
      />
      <StatTile
        label="SIM"
        value={swapToday ? "Swapped today" : sub.sim.last_swap_at ? `Swapped ${formatWhen(sub.sim.last_swap_at, now)}` : "No swaps"}
        sub={
          sub.sim.last_swap_at
            ? `${formatClock(sub.sim.last_swap_at)}${sub.sim.swap_agent ? ` at ${sub.sim.swap_agent}` : ""}`
            : `${sub.sim.age_months} months on this SIM`
        }
      />
      <StatTile label="Device" value={sub.device.model} sub={newDevice ? `New since ${formatClock(sub.device.first_seen)}` : `In use ${sub.device.usual_months} months`} />
    </div>
  );
}

/** C12 · Why this subscriber is high-risk — rule · reason, points right. */
export function WhyHighRisk({ sub }: { sub: Subscriber }) {
  const reasons = sub.risk_reasons;
  return (
    <Card title="Why this subscriber is high-risk" aside={<CardMeta>Score {sub.risk_score}</CardMeta>}>
      {reasons.length ? (
        <DetailRows rows={reasons.map((r) => [`${r.rule_id} · ${r.text}`, `+${r.points}`])} />
      ) : (
        <p className="pb-2 text-body-s text-text-secondary">No rule has fired on this subscriber.</p>
      )}
    </Card>
  );
}

/** “20k” · “10k” */
const short = (ghs: number) => (ghs >= 1000 ? `${Math.round(ghs / 100) / 10}k`.replace(".0k", "k") : String(ghs));

/** C12 · Chart card — MoMo outflow per day, ordinary days grey, today red, tooltip on today. */
export function OutflowChart({ id }: { id: string }) {
  const { data } = useOutflow(id, 12);
  if (!data) return <CardSkeleton />;
  const days = data.days;
  const peak = Math.max(...days.map((d) => d.amount.amount_minor), data.today.amount_minor, 1);
  // Axis top: the next round 10k above the busiest day.
  const step = 10_000_00;
  const top = Math.max(step, Math.ceil(peak / step) * step);
  const currency = data.today.currency;
  const label = (i: number) => {
    if (i === days.length - 1) return "Today";
    if (i === 0) return new Date(days[i].date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
    return i % 3 === 0 ? new Date(days[i].date).toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ }) : "";
  };
  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-base p-6">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-title text-text-primary">MoMo outflow · last {days.length} days</h3>
        <p className="text-caption text-text-tertiary">
          Usual day {money(data.typical.min)}-{money(data.typical.max).replace(`${currency} `, "")} · today {money(data.today)}
        </p>
      </div>
      <div className="flex gap-2" role="img" aria-label={`Money out per day for the last ${days.length} days`}>
        <div className="flex h-60 w-12 shrink-0 flex-col items-end justify-between text-caption text-text-secondary">
          <span>
            {currency} {short(top / 100)}
          </span>
          <span>
            {currency} {short(top / 200)}
          </span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative flex h-60 items-end justify-between border-b border-border-default">
            <span className="absolute inset-x-0 top-0 h-px bg-border-subtle" />
            <span className="absolute inset-x-0 top-1/2 h-px bg-border-subtle" />
            {days.map((d, i) => {
              const today = i === days.length - 1;
              return (
                <span key={d.date} className="relative flex w-8 justify-center">
                  {today && (
                    <span className="absolute right-0 bottom-full mb-2 flex flex-col rounded-md bg-surface-inverse px-2 py-1.5 text-caption whitespace-nowrap text-text-inverse">
                      <span>Today · {money(d.amount)} out</span>
                    </span>
                  )}
                  <span
                    title={`${formatDate(d.date)}: ${money(d.amount)}`}
                    className={cn("w-8 rounded-t", today ? "bg-critical-solid" : "bg-border-strong")}
                    style={{ height: `${Math.max(2, (d.amount.amount_minor / top) * 240)}px` }}
                  />
                </span>
              );
            })}
          </div>
          <div className="flex justify-between">
            {days.map((d, i) => (
              <span key={d.date} className="flex w-8 justify-center text-caption whitespace-nowrap text-text-secondary">
                {label(i)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Timeline tone for a recent event (the app owns tones; the API only says what happened). */
const recentTone = (e: RecentEvent): TimelineTone =>
  e.flagged && (e.kind === "payments_out" || e.kind === "transfer_out") ? "loss" : e.flagged && /sim|device/.test(e.kind) ? "risk" : "neutral";

/** C12 · Recent activity — timeline, newest first. */
export function RecentActivity({ id, now, total, onViewAll }: { id: string; now: number; total?: number; onViewAll: () => void }) {
  const { data } = useRecent(id);
  return (
    <Card
      title="Recent activity"
      aside={
        <button type="button" onClick={onViewAll} className="flex h-8 items-center rounded text-label-s text-text-brand hover:underline">
          View all{total !== undefined ? ` ${total}` : ""}
        </button>
      }
    >
      {data ? (
        <Timeline
          events={data.data.map((e, i) => ({
            key: `${e.at}-${i}`,
            time: formatWhen(e.at, now),
            tone: recentTone(e),
            title: e.text,
            detail: e.until
              ? `${formatClock(e.at)} to ${formatClock(e.until)}${e.amount ? ` · ${money(e.amount)}` : ""}`
              : e.amount
                ? money(e.amount)
                : undefined,
          }))}
        />
      ) : (
        <div className="flex flex-col gap-3 pb-2" aria-hidden>
          <Skeleton className="h-2.5 w-[60%]" />
          <Skeleton className="h-2.5 w-[50%]" />
          <Skeleton className="h-2.5 w-[55%]" />
        </div>
      )}
    </Card>
  );
}

/** Card header link — Label/S brand, no arrow, as a button. */
function CardAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 items-center rounded text-label-s text-text-brand hover:underline">
      {children}
    </button>
  );
}

/** C12/C15/C16 · Identity · KYC — masked until revealed; “Not available” when the KYC registry is down. */
export function IdentityCard({
  sub,
  revealed,
  now,
  onReveal,
  onHide,
}: {
  sub: Subscriber;
  revealed: Revealed | null;
  now: number;
  onReveal: () => void;
  onHide: () => void;
}) {
  const kycDown = sub.unavailable.includes("kyc");
  const v = revealed?.values;
  return (
    <Card
      title="Identity · KYC"
      aside={
        revealed ? (
          <span className="flex items-center gap-3">
            <CardMeta>Shown · {formatSpan(Date.parse(revealed.expires_at) - now)} left</CardMeta>
            <CardAction onClick={onHide}>Hide now</CardAction>
          </span>
        ) : kycDown ? (
          // TODO(api): 0.2 doesn’t say when KYC was last synced (C16).
          <CardMeta>Last synced earlier</CardMeta>
        ) : (
          <CardAction onClick={onReveal}>Reveal</CardAction>
        )
      }
    >
      <DetailRows
        rows={[
          ["Name on wallet", v?.name ?? `${sub.name} (masked)`],
          ["ID", kycDown ? "Not available" : `Ghana Card · ${v?.ghana_card ?? sub.kyc.ghana_card}`],
          ["Verified", kycDown ? "Not available" : [formatDate(sub.kyc.verified_at), sub.kyc.branch].filter(Boolean).join(" · ")],
          ["Date of birth", v?.date_of_birth ? formatDate(v.date_of_birth) : sub.kyc.date_of_birth],
          ["Alternate number", v?.alt_msisdn ? localNumber(v.alt_msisdn) : sub.contact.alt_msisdn],
        ]}
      />
    </Card>
  );
}

/** C12 · SIM and device. */
export function SimDeviceCard({ sub, now }: { sub: Subscriber; now: number }) {
  const swapToday = isToday(sub.sim.last_swap_at, now);
  const newDevice = isToday(sub.device.first_seen, now);
  return (
    <Card title="SIM and device">
      <DetailRows
        rows={[
          ["SIM (ICCID)", sub.sim.iccid],
          ["SIM age", swapToday ? `Swapped today ${formatClock(sub.sim.last_swap_at!)}` : `${sub.sim.age_months} months`],
          ["Swap agent", sub.sim.swap_agent ? [sub.sim.swap_agent, swapPlace(sub)].filter(Boolean).join(" · ") : "None"],
          ["Device now", newDevice ? `${sub.device.model} · since ${formatClock(sub.device.first_seen)}` : sub.device.model],
          ["Usual device", `${sub.device.usual_model} · ${sub.device.usual_months} months`],
        ]}
      />
    </Card>
  );
}

/** C12/C16 · Mobile money. */
export function MobileMoneyCard({ sub }: { sub: Subscriber }) {
  const w = sub.wallet;
  const down = sub.unavailable.includes("wallet");
  return (
    <Card title="Mobile money" aside={down ? <CardMeta>{sub.wallet_as_of ? `As of ${formatClock(sub.wallet_as_of)}` : "Out of date"}</CardMeta> : undefined}>
      <DetailRows
        rows={[
          ["Wallet", `Tier ${w.tier} · limit ${money(w.daily_limit)} a day`],
          ["Status", w.status === "frozen" ? `Frozen${w.frozen_at ? ` ${formatClock(w.frozen_at)}` : ""}${w.frozen_by ? ` by ${w.frozen_by.name.split(" ")[0]}` : ""}` : "Active"],
          ["Balance", down ? "Not available" : money(w.balance, true)],
          ["Usual recipients", String(w.usual_recipients)],
          ["New recipients today", String(w.new_recipients_today)],
        ]}
      />
    </Card>
  );
}

/* ───────────────────────── C13 · SIM & devices ───────────────────────── */

const DEVICE_STATUS: Record<"new" | "usual" | "retired", { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "critical" },
  usual: { label: "Usual", tone: "neutral" },
  retired: { label: "Retired", tone: "neutral" },
};

/** New today (or flagged) · Usual (seen in the last 30 days) · Retired. */
function deviceStatus(d: Subscriber["devices_on_wallet"][number], now: number) {
  if (d.risky || isToday(d.first_seen, now)) return DEVICE_STATUS.new;
  return now - Date.parse(d.last_seen) < 30 * 86_400_000 ? DEVICE_STATUS.usual : DEVICE_STATUS.retired;
}

/** Now · Today 08:39 · Aug 2023 · 2019 */
function seen(iso: string, now: number) {
  if (now - Date.parse(iso) < 15 * 60_000) return "Now";
  const when = formatWhen(iso, now, { withTime: true });
  if (when.startsWith("Today") || when === "Yesterday") return when;
  return now - Date.parse(iso) > 3 * 365 * 86_400_000 ? String(new Date(iso).getFullYear()) : monthYear(iso);
}

const ID_DOCUMENT: Record<string, string> = { ghana_card: "Ghana Card", passport: "Passport", voter_id: "Voter ID" };

/** C13 · Devices on this SIM (table) + SIM history (timeline). */
export function SimDevicesTab({ sub, now }: { sub: Subscriber; now: number }) {
  const devices = sub.devices_on_wallet;
  return (
    <div className="flex items-start gap-6">
      <Card title="Devices on this SIM" aside={<CardMeta>{devices.length} {devices.length === 1 ? "device" : "devices"}</CardMeta>} className="min-w-0 flex-1">
        <div className="mb-1 overflow-hidden rounded-lg border border-border-default">
          <table className="w-full text-left">
            <thead className="bg-surface-raised">
              <tr className="text-caption text-text-secondary">
                {["Device", "First seen", "Last seen", "Status"].map((h, i) => (
                  <th key={h} scope="col" className={cn("h-10 border-b border-border-default px-4 font-normal", i === 0 && "w-1/2")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const s = deviceStatus(d, now);
                return (
                  <tr key={d.imei} className="border-b border-border-default last:border-b-0 hover:bg-surface-sunken">
                    <td className="h-16 px-4">
                      <span className="flex flex-col">
                        <span className="text-body-s text-text-primary">{d.model}</span>
                        <span className="text-caption text-text-secondary">IMEI {d.imei}</span>
                      </span>
                    </td>
                    <td className="px-4 text-body-s text-text-primary">{seen(d.first_seen, now)}</td>
                    <td className="px-4 text-body-s text-text-primary">{seen(d.last_seen, now)}</td>
                    <td className="px-4">
                      <Badge label={s.label} tone={s.tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="SIM history" className="w-[400px] shrink-0">
        <Timeline
          events={sub.sim_history.map((h) => {
            const doc = ID_DOCUMENT[h.id_check.document] ?? h.id_check.document.replace(/_/g, " ");
            const swap = h.event === "sim_swap";
            return {
              key: h.at,
              time: formatWhen(h.at, now),
              tone: swap ? "risk" : "neutral",
              title: swap ? `SIM swap at ${[h.agent, h.place.split(", ")[0]].filter(Boolean).join(", ")}` : "SIM registered",
              detail: swap
                ? `ID shown: ${doc}${h.id_check.method === "biometric" ? "" : " · no biometric check"}${h.id_check.matched ? "" : " · not matched"}`
                : `${h.place} · ${doc}`,
            };
          })}
        />
      </Card>
    </div>
  );
}

/* ───────────────────────── Cases ───────────────────────── */

/** Case history as party rows: case + what, status pill (closed ones read “False positive”). */
export function CaseHistoryRows({ cases, now }: { cases: Subscriber["cases"]; now: number }) {
  return (
    <ul className="flex flex-col">
      {cases.map((c) => (
        <PartyRow
          key={c.id}
          href={`/cases/${c.id}`}
          title={c.id}
          sub={`${c.title} · ${isToday(c.waiting_since, now) ? "today" : monthYear(c.waiting_since)}`}
          aside={c.status === "closed" ? <Badge label="False positive" tone="success" /> : <CaseStatusBadge status={c.status} />}
        />
      ))}
    </ul>
  );
}
