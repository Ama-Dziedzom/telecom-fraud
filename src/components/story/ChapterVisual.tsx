"use client";

import { Icon } from "@/components/ui/Icon";
import type { Money, PersonRef } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { TZ, formatClock, formatDate, formatMoney } from "@/lib/time";

/** A fact beside the picture; `title` and `detail` are engine text, `kind` picks the icon. */
type Fact = { kind: string; title: string; detail: string };

/** The picture beside each chapter, from GET /cases/{id}/brief. Titles and subtitles are engine text. */
export type Visual =
  | { kind: "agent_swaps"; agent: { code: string; name: string; area: string; agent_since: string }; facts: Fact[]; by_day: Array<{ date: string; count: number }> }
  | {
      kind: "two_phones";
      distance_km: number;
      phones: Array<{ model: string; place: string; usual: boolean; used_months: number; event: "went_silent" | "signed_in"; at: string }>;
      facts: Fact[];
    }
  | { kind: "transfers"; title: string; subtitle: string; limit: Money; bars: Array<{ at: string; amount: Money }>; balance: { from: Money; to: Money } }
  | {
      kind: "flow";
      title: string;
      subtitle: string;
      source: { msisdn: string; subscriber_id: string };
      destinations: Array<{
        kind: "wallet" | "agent";
        identifier: string;
        entity_id: string;
        amount: Money;
        case_id: string | null;
        cashed_out: boolean;
        /** The agent it was cashed out at (its own ID for an agent). */
        cashed_out_at?: string;
      }>;
    }
  | { kind: "actions"; title: string; items: Array<{ kind: string; title: string; actor: PersonRef | null; at: string; detail: string | null }> }
  | {
      kind: "standing";
      tiles: Array<{ kind: "taken" | "kept_by_freeze" | "held_for_reversal" | "recovered" | "lost"; amount: Money }>;
      next: Array<{ done: boolean; title: string; at: string | null; by: PersonRef | null; due_at: string | null }>;
    };

const FACT_ICON: Record<string, [string, string]> = {
  sim_reissued: ["app/icon-sim-high-20", "bg-high-bg"],
  no_biometric: ["app/icon-fingerprint-critical-22", "bg-critical-bg"],
  imei_invalid: ["app/icon-fingerprint-critical-22", "bg-critical-bg"],
  pin_known: ["app/icon-lock-high-18", "bg-high-bg"],
};

function FactRow({ fact }: { fact: Fact }) {
  const [glyph, tile] = FACT_ICON[fact.kind] ?? FACT_ICON.sim_reissued;
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", tile)}>
        <Icon name={glyph} size={18} />
      </span>
      <span className="flex flex-col">
        <span className="text-label-m text-text-primary">{fact.title}</span>
        <span className="text-caption text-text-secondary">{fact.detail}</span>
      </span>
    </div>
  );
}

const money = (m: Money) => formatMoney(m.amount_minor, m.currency);
const dayOf = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
/** “Mon” — or “Today”. */
const weekday = (date: string, now: number) =>
  date === dayOf(now) ? "Today" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });
/** “2 years” · “8 months” */
const usedFor = (months: number) => (months >= 12 ? `${Math.floor(months / 12)} year${months >= 24 ? "s" : ""}` : `${months} month${months === 1 ? "" : "s"}`);
/** “today 16:00” · “22 Oct” */
const due = (iso: string, now: number) => (dayOf(iso) === dayOf(now) ? `today ${formatClock(iso)}` : formatDate(iso).replace(/ \d{4}$/, ""));

const TILE: Record<string, { label: string; tone: "critical" | "success" | "medium" }> = {
  taken: { label: "Taken", tone: "critical" },
  kept_by_freeze: { label: "Saved by the freeze", tone: "success" },
  held_for_reversal: { label: "Held for reversal", tone: "medium" },
  recovered: { label: "Recovered", tone: "success" },
  lost: { label: "Lost", tone: "critical" },
};

const ACTION_TILE: Record<string, [string, string]> = {
  picked_up: ["app/icon-user-brand-20", "bg-brand-primary-subtle"],
  frozen: ["app/icon-shield-success-18", "bg-success-bg"],
  called: ["app/icon-phone-brand-24", "bg-brand-primary-subtle"],
  reversal_requested: ["app/icon-refresh-medium-18", "bg-medium-bg"],
  agent_reported: ["app/icon-building-high-20", "bg-high-bg"],
};

export function ChapterVisual({ visual, now, subjectName }: { visual: Visual; now: number; subjectName?: string }) {
  switch (visual.kind) {
    case "agent_swaps": {
      const max = Math.max(...visual.by_day.map((d) => d.count), 12);
      const days = visual.by_day.map((d) => ({ ...d, label: weekday(d.date, now) }));
      return (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-high-bg">
              <Icon name="app/icon-building-high-20" size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-title text-text-primary">
                Agent {visual.agent.code} · {visual.agent.area}
              </span>
              <span className="text-caption text-text-secondary">Kasa MoMo agent since {visual.agent.agent_since.slice(0, 4)}</span>
            </span>
          </div>
          {visual.facts.map((f) => (
            <FactRow key={f.title} fact={f} />
          ))}
          <div className="flex flex-col gap-2">
            <span className="text-caption text-text-secondary">SIM swaps by this agent</span>
            <div className="relative h-[100px] pl-8">
              {[0, 6, 12].map((v) => (
                <span key={v} className="absolute right-0 left-8 h-px bg-border-subtle" style={{ bottom: `${(v / max) * 100}%` }}>
                  <span className="absolute -left-8 -translate-y-1/2 font-mono text-mono-s text-text-tertiary">{v}</span>
                </span>
              ))}
              <div className="relative flex h-full items-end gap-3">
                {days.map((d) => (
                  <span key={d.date} className={cn("flex-1 rounded-t-[3px]", d.label === "Today" ? "bg-critical-fg" : "bg-brand-highlight/60")} style={{ height: `${(d.count / max) * 100}%` }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pl-8">
              {days.map((d) => (
                <span key={d.date} className={cn("flex-1 font-mono text-mono-s", d.label === "Today" ? "text-right text-critical-fg" : "text-text-tertiary")}>
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </>
      );
    }
    case "two_phones": {
      // The usual phone first, then the new one.
      const phones = [...visual.phones]
        .sort((a, b) => Number(b.usual) - Number(a.usual))
        .map((p) => ({
          model: p.model,
          sub: p.usual ? `His phone · ${p.place} · ${usedFor(p.used_months)}` : `New · ${p.place}`,
          note: `${p.event === "went_silent" ? "Went silent" : "Signed in"} ${formatClock(p.at)}`,
        }));
      return (
        <>
          <div className="flex items-center gap-2">
            {phones.map((p, i) => (
              <div key={p.model} className={cn("flex flex-1 flex-col gap-1.5 rounded-xl border px-4 py-3.5", i === 0 ? "border-border-subtle bg-surface-raised" : "border-critical-border bg-critical-bg")}>
                <span className={cn("flex size-8 items-center justify-center rounded-lg", i === 0 ? "bg-surface-sunken" : "bg-surface-base")}>
                  <Icon name={i === 0 ? "app/icon-phone-neutral-20" : "app/icon-phone-critical-20"} size={18} />
                </span>
                <span className="text-title text-text-primary">{p.model}</span>
                <span className="text-caption text-text-secondary">{p.sub}</span>
                <span className={cn("flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium", i === 0 ? "bg-neutral-bg text-neutral-fg" : "text-critical-fg")}>
                  <span className={cn("size-1.5 rounded-full", i === 0 ? "bg-neutral-fg" : "bg-critical-fg")} />
                  {p.note}
                </span>
              </div>
            )).flatMap((el, i) =>
              i === 0
                ? [
                    el,
                    <div key="gap" className="flex w-20 shrink-0 flex-col items-center gap-1">
                      <span className="text-label-m text-critical-fg">{visual.distance_km} km</span>
                      <span className="h-px w-full bg-critical-border" />
                      <span className="text-caption text-critical-fg">different city</span>
                    </div>,
                  ]
                : [el],
            )}
          </div>
          {visual.facts.map((f) => (
            <FactRow key={f.title} fact={f} />
          ))}
        </>
      );
    }
    case "transfers": {
      // Axis in whole thousands of cedis, to the biggest bar.
      const max = Math.max(1000, Math.ceil(Math.max(...visual.bars.map((b) => b.amount.amount_minor)) / 100_000) * 1000);
      const currency = visual.balance.from.currency;
      const left = (visual.balance.to.amount_minor / visual.balance.from.amount_minor) * 100;
      return (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-critical-bg">
              <Icon name="app/icon-send-critical-20" size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-title text-text-primary">{visual.title}</span>
              <span className="text-caption text-text-secondary">{visual.subtitle}</span>
            </span>
          </div>
          <div className="relative h-[120px] pl-14">
            {[0, max / 2, max].map((v) => (
              <span key={v} className="absolute right-0 left-14 h-px bg-border-subtle" style={{ bottom: `${(v / max) * 100}%` }}>
                <span className="absolute -left-14 -translate-y-1/2 font-mono text-mono-s text-text-tertiary">{formatMoney(v * 100, currency)}</span>
              </span>
            ))}
            <div className="relative flex h-full items-end gap-4">
              {visual.bars.map((b) => (
                <span key={b.at} title={money(b.amount)} className="flex-1 rounded-t-[3px] bg-critical-fg" style={{ height: `${(b.amount.amount_minor / 100 / max) * 100}%` }} />
              ))}
            </div>
          </div>
          <div className="flex gap-4 pl-14">
            {visual.bars.map((b) => (
              <span key={b.at} className="flex-1 font-mono text-mono-s text-critical-fg">
                {formatClock(b.at)}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-caption text-text-secondary">
              Wallet balance <span className="font-mono text-mono-s text-critical-fg">{money(visual.balance.from)} down to {money(visual.balance.to)}</span>
            </span>
            <span className="h-1.5 w-full rounded-full bg-critical-bg">
              <span className="block h-1.5 rounded-full bg-success-fg" style={{ width: `${Math.max(1.5, left)}%` }} />
            </span>
          </div>
        </>
      );
    }
    case "flow": {
      const dest = visual.destinations;
      const total = dest.reduce((s, d) => s + d.amount.amount_minor, 0);
      const step = 256 / dest.length;
      const ys = dest.map((_, i) => step / 2 + i * step);
      // Wallets emptied at an agent flow on to that agent; an agent destination is the cash-out itself.
      const sink = dest.find((d) => d.kind === "wallet" && d.cashed_out && d.cashed_out_at)?.cashed_out_at;
      const known = dest.find((d) => d.kind === "wallet" && d.case_id);
      return (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-critical-bg">
              <Icon name="app/icon-users-critical-20" size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-title text-text-primary">{visual.title}</span>
              <span className="text-caption text-text-secondary">{visual.subtitle}</span>
            </span>
          </div>
          {/* One coordinate system for boxes and ribbons: x in % of the width, y in px. */}
          <div className="relative h-[256px]">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 256" preserveAspectRatio="none" aria-hidden>
              {dest.map((d, i) => (
                <g key={d.entity_id}>
                  <path
                    d={`M 19 128 C 29 128, 29 ${ys[i]}, 39 ${ys[i]}`}
                    fill="none"
                    stroke="#b51c1c"
                    strokeOpacity={0.35}
                    strokeWidth={(d.amount.amount_minor / total) * 56}
                    vectorEffect="non-scaling-stroke"
                  />
                  {d.kind === "wallet" && d.cashed_out && d.cashed_out_at === sink && (
                    <path
                      d={`M 64 ${ys[i]} C 72 ${ys[i]}, 72 64, 80 64`}
                      fill="none"
                      stroke="#c2410c"
                      strokeOpacity={0.45}
                      strokeWidth={(d.amount.amount_minor / total) * 48}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              ))}
            </svg>
            <div className="absolute top-1/2 left-0 flex w-[19%] -translate-y-1/2 items-center gap-2 rounded-lg border border-high-border bg-high-bg px-2.5 py-2">
              <Icon name="app/icon-wallet-critical-16" size={14} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-mono-s text-text-primary">{visual.source.msisdn}</span>
                <span className="truncate text-[11px] text-text-secondary">{subjectName ? `${subjectName.split(" ")[0]}’s wallet` : "Their wallet"}</span>
              </span>
            </div>
            {dest.map((d, i) => (
              <div
                key={d.entity_id}
                className="absolute flex w-[25%] -translate-y-1/2 items-center gap-2 rounded-lg border border-critical-border bg-critical-bg px-2.5 py-2"
                style={{ left: "39%", top: ys[i] }}
              >
                <Icon name={d.kind === "agent" ? "app/icon-building-high-20" : "app/icon-wallet-critical-16"} size={14} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-mono-s text-text-primary">{d.identifier}</span>
                  <span className="truncate text-[11px] text-text-secondary">
                    {money(d.amount)} · {d.case_id ? `in ${d.case_id}` : d.kind === "agent" ? "cash-out" : "new wallet"}
                  </span>
                </span>
              </div>
            ))}
            {sink && (
              <div className="absolute right-0 flex w-[20%] -translate-y-1/2 items-center gap-2 rounded-lg border border-high-border bg-high-bg px-2.5 py-2" style={{ top: 64 }}>
                <Icon name="app/icon-building-high-20" size={14} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-mono-s text-text-primary">Agent {sink}</span>
                  <span className="truncate text-[11px] text-text-secondary">Cash-out</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {known && (
              <span className="flex items-center gap-1.5 rounded-full bg-critical-bg px-2 py-0.5 text-caption font-medium text-critical-fg">
                <span className="size-1.5 rounded-full bg-critical-fg" />
                {known.identifier} is already in {known.case_id}
              </span>
            )}
            <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-caption font-medium text-neutral-fg">Line thickness = amount</span>
          </div>
        </>
      );
    }
    case "actions": {
      return (
        <>
          <p className="text-title text-text-primary">{visual.title}</p>
          <ul className="flex flex-col gap-2">
            {visual.items.map((item) => (
              <li key={item.title} className="flex items-center gap-3 rounded-[10px] bg-surface-raised px-3 py-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", ACTION_TILE[item.kind]?.[1] ?? "bg-brand-primary-subtle")}>
                  <Icon name={ACTION_TILE[item.kind]?.[0] ?? "app/icon-user-brand-20"} size={16} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-label-m text-text-primary">{item.title}</span>
                  <span className="text-caption text-text-secondary">{[item.actor?.name, item.detail].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="font-mono text-mono-s text-text-tertiary">{formatClock(item.at)}</span>
              </li>
            ))}
          </ul>
        </>
      );
    }
    case "standing": {
      const TONE = {
        critical: ["border-critical-border bg-critical-bg", "text-critical-fg", "icon-alert-triangle-critical-24"],
        success: ["border-success-border bg-success-bg", "text-success-fg", "app/icon-shield-success-18"],
        medium: ["border-medium-border bg-medium-bg", "text-medium-fg", "app/icon-refresh-medium-18"],
      } as const;
      return (
        <>
          <div className="flex gap-2.5">
            {visual.tiles.map((t) => {
              const { label, tone } = TILE[t.kind] ?? { label: t.kind.replace(/_/g, " "), tone: "medium" as const };
              return (
                <div key={t.kind} className={cn("flex flex-1 flex-col gap-1.5 rounded-xl border px-3.5 py-3", TONE[tone][0])}>
                  <span className="flex items-center gap-1.5 text-caption text-text-secondary">
                    <Icon name={TONE[tone][2]} size={14} />
                    {label}
                  </span>
                  <span className={cn("text-h3", TONE[tone][1])}>{money(t.amount)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-caption text-text-secondary">What happens next</p>
          <ul className="flex flex-col gap-2.5">
            {visual.next.map((n) => (
              <li key={n.title} className="flex items-center gap-3">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", n.done ? "bg-success-bg" : "bg-surface-sunken")}>
                  <Icon name={n.done ? "app/icon-check-success-16" : "app/icon-circle-dashed-16"} size={14} />
                </span>
                <span className="flex flex-col">
                  <span className="text-label-m text-text-primary">{n.title}</span>
                  <span className="text-caption text-text-secondary">
                    {(n.done
                      ? [n.at && formatClock(n.at), n.by?.name]
                      : [n.by?.name, n.due_at && `due ${due(n.due_at, now)}`]
                    )
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      );
    }
  }
}
