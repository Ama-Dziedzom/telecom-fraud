"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/** The picture beside each chapter. Data comes from GET /cases/{id}/brief (proposed `visual`). */
export type Visual =
  | { kind: "agent_swaps"; agent: string; since: string; facts: Array<[string, string, string]>; by_day: Array<[string, number]> }
  | {
      kind: "two_phones";
      a: { model: string; sub: string; note: string };
      b: { model: string; sub: string; note: string };
      distance: string;
      facts: Array<[string, string, string]>;
    }
  | { kind: "transfers"; title: string; sub: string; bars: Array<[string, number]>; balance: { from: number; to: number } }
  | {
      kind: "flow";
      title: string;
      sub: string;
      source: [string, string];
      wallets: Array<[string, string, number, boolean]>;
      sink: [string, string];
      notes: string[];
    }
  | { kind: "actions"; title: string; items: Array<[string, string, string, string]> }
  | { kind: "standing"; tiles: Array<[string, string, string, "critical" | "success" | "medium"]>; next: Array<[boolean, string, string]> };

const FACT_ICON: Record<string, [string, string]> = {
  sim: ["app/icon-sim-high-20", "bg-high-bg"],
  fingerprint: ["app/icon-fingerprint-critical-22", "bg-critical-bg"],
  lock: ["app/icon-lock-high-18", "bg-high-bg"],
};

function Fact({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  const [glyph, tile] = FACT_ICON[icon] ?? FACT_ICON.sim;
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", tile)}>
        <Icon name={glyph} size={18} />
      </span>
      <span className="flex flex-col">
        <span className="text-label-m text-text-primary">{title}</span>
        <span className="text-caption text-text-secondary">{sub}</span>
      </span>
    </div>
  );
}

const money = (cedis: number) => `GHS ${cedis.toLocaleString("en-GB")}`;

export function ChapterVisual({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case "agent_swaps": {
      const max = Math.max(...visual.by_day.map(([, n]) => n), 12);
      return (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-high-bg">
              <Icon name="app/icon-building-high-20" size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-title text-text-primary">{visual.agent}</span>
              <span className="text-caption text-text-secondary">{visual.since}</span>
            </span>
          </div>
          {visual.facts.map(([icon, title, sub]) => (
            <Fact key={title} icon={icon} title={title} sub={sub} />
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
                {visual.by_day.map(([day, n]) => (
                  <span key={day} className={cn("flex-1 rounded-t-[3px]", day === "Today" ? "bg-critical-fg" : "bg-brand-highlight/60")} style={{ height: `${(n / max) * 100}%` }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pl-8">
              {visual.by_day.map(([day]) => (
                <span key={day} className={cn("flex-1 font-mono text-mono-s", day === "Today" ? "text-right text-critical-fg" : "text-text-tertiary")}>
                  {day}
                </span>
              ))}
            </div>
          </div>
        </>
      );
    }
    case "two_phones":
      return (
        <>
          <div className="flex items-center gap-2">
            {[visual.a, visual.b].map((p, i) => (
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
                      <span className="text-label-m text-critical-fg">{visual.distance}</span>
                      <span className="h-px w-full bg-critical-border" />
                      <span className="text-caption text-critical-fg">different city</span>
                    </div>,
                  ]
                : [el],
            )}
          </div>
          {visual.facts.map(([icon, title, sub]) => (
            <Fact key={title} icon={icon} title={title} sub={sub} />
          ))}
        </>
      );
    case "transfers": {
      const max = 4000;
      const left = (visual.balance.to / visual.balance.from) * 100;
      return (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-critical-bg">
              <Icon name="app/icon-send-critical-20" size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-title text-text-primary">{visual.title}</span>
              <span className="text-caption text-text-secondary">{visual.sub}</span>
            </span>
          </div>
          <div className="relative h-[120px] pl-14">
            {[0, 2000, 4000].map((v) => (
              <span key={v} className="absolute right-0 left-14 h-px bg-border-subtle" style={{ bottom: `${(v / max) * 100}%` }}>
                <span className="absolute -left-14 -translate-y-1/2 font-mono text-mono-s text-text-tertiary">GHS {v.toLocaleString("en-GB")}</span>
              </span>
            ))}
            <div className="relative flex h-full items-end gap-4">
              {visual.bars.map(([t, v]) => (
                <span key={t} title={money(v)} className="flex-1 rounded-t-[3px] bg-critical-fg" style={{ height: `${(v / max) * 100}%` }} />
              ))}
            </div>
          </div>
          <div className="flex gap-4 pl-14">
            {visual.bars.map(([t]) => (
              <span key={t} className="flex-1 font-mono text-mono-s text-critical-fg">
                {t}
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
      const total = visual.wallets.reduce((s, [, , v]) => s + v, 0);
      const ys = visual.wallets.map((_, i) => 32 + i * 64);
      return (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-critical-bg">
              <Icon name="app/icon-users-critical-20" size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-title text-text-primary">{visual.title}</span>
              <span className="text-caption text-text-secondary">{visual.sub}</span>
            </span>
          </div>
          {/* One coordinate system for boxes and ribbons: x in % of the width, y in px. */}
          <div className="relative h-[256px]">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 256" preserveAspectRatio="none" aria-hidden>
              {visual.wallets.map(([, , v, cashed], i) => (
                <g key={i}>
                  <path
                    d={`M 19 128 C 29 128, 29 ${ys[i]}, 39 ${ys[i]}`}
                    fill="none"
                    stroke="#b51c1c"
                    strokeOpacity={0.35}
                    strokeWidth={(v / total) * 56}
                    vectorEffect="non-scaling-stroke"
                  />
                  {cashed && (
                    <path
                      d={`M 64 ${ys[i]} C 72 ${ys[i]}, 72 64, 80 64`}
                      fill="none"
                      stroke="#c2410c"
                      strokeOpacity={0.45}
                      strokeWidth={(v / total) * 48}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              ))}
            </svg>
            <div className="absolute top-1/2 left-0 flex w-[19%] -translate-y-1/2 items-center gap-2 rounded-lg border border-high-border bg-high-bg px-2.5 py-2">
              <Icon name="app/icon-wallet-critical-16" size={14} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-mono-s text-text-primary">{visual.source[0]}</span>
                <span className="truncate text-[11px] text-text-secondary">{visual.source[1]}</span>
              </span>
            </div>
            {visual.wallets.map(([n, sub], i) => (
              <div
                key={n}
                className="absolute flex w-[25%] -translate-y-1/2 items-center gap-2 rounded-lg border border-critical-border bg-critical-bg px-2.5 py-2"
                style={{ left: "39%", top: ys[i] }}
              >
                <Icon name="app/icon-wallet-critical-16" size={14} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-mono-s text-text-primary">{n}</span>
                  <span className="truncate text-[11px] text-text-secondary">{sub}</span>
                </span>
              </div>
            ))}
            <div className="absolute right-0 flex w-[20%] -translate-y-1/2 items-center gap-2 rounded-lg border border-high-border bg-high-bg px-2.5 py-2" style={{ top: 64 }}>
              <Icon name="app/icon-building-high-20" size={14} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-mono-s text-text-primary">{visual.sink[0]}</span>
                <span className="truncate text-[11px] text-text-secondary">{visual.sink[1]}</span>
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-critical-bg px-2 py-0.5 text-caption font-medium text-critical-fg">
              <span className="size-1.5 rounded-full bg-critical-fg" />
              {visual.notes[0]}
            </span>
            <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-caption font-medium text-neutral-fg">{visual.notes[1]}</span>
          </div>
        </>
      );
    }
    case "actions": {
      const TILE: Record<string, [string, string]> = {
        user: ["app/icon-user-brand-20", "bg-brand-primary-subtle"],
        shield: ["app/icon-shield-success-18", "bg-success-bg"],
        phone: ["app/icon-phone-brand-24", "bg-brand-primary-subtle"],
        refresh: ["app/icon-refresh-medium-18", "bg-medium-bg"],
        building: ["app/icon-building-high-20", "bg-high-bg"],
      };
      return (
        <>
          <p className="text-title text-text-primary">{visual.title}</p>
          <ul className="flex flex-col gap-2">
            {visual.items.map(([icon, title, sub, at]) => (
              <li key={title} className="flex items-center gap-3 rounded-[10px] bg-surface-raised px-3 py-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TILE[icon]?.[1])}>
                  <Icon name={TILE[icon]?.[0] ?? "app/icon-user-brand-20"} size={16} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-label-m text-text-primary">{title}</span>
                  <span className="text-caption text-text-secondary">{sub}</span>
                </span>
                <span className="font-mono text-mono-s text-text-tertiary">{at}</span>
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
            {visual.tiles.map(([, label, value, tone]) => (
              <div key={label} className={cn("flex flex-1 flex-col gap-1.5 rounded-xl border px-3.5 py-3", TONE[tone][0])}>
                <span className="flex items-center gap-1.5 text-caption text-text-secondary">
                  <Icon name={TONE[tone][2]} size={14} />
                  {label}
                </span>
                <span className={cn("text-h3", TONE[tone][1])}>{value}</span>
              </div>
            ))}
          </div>
          <p className="text-caption text-text-secondary">What happens next</p>
          <ul className="flex flex-col gap-2.5">
            {visual.next.map(([done, title, sub]) => (
              <li key={title} className="flex items-center gap-3">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", done ? "bg-success-bg" : "bg-surface-sunken")}>
                  <Icon name={done ? "app/icon-check-success-16" : "app/icon-circle-dashed-16"} size={14} />
                </span>
                <span className="flex flex-col">
                  <span className="text-label-m text-text-primary">{title}</span>
                  <span className="text-caption text-text-secondary">{sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      );
    }
  }
}
