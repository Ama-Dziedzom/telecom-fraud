"use client";

import { Skeleton } from "@/components/app/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useApi, type CaseSummary, type Money, type PersonRef, type SubscriberRef } from "@/lib/api/fd";
import { formatClock, formatMoney, TZ, useNow } from "@/lib/time";
import Link from "next/link";
import { useMemo } from "react";

/** A case on the board: a case list item, plus what its stage needs. */
type BoardCase = Omit<CaseSummary, "stage" | "subscriber" | "region" | "sla_due_at"> & {
  kind?: undefined;
  stage: CaseSummary["stage"] | "monitor";
  subscriber: SubscriberRef | null;
  region: string | null;
  sla_due_at: string | null;
  watch_days_left?: number;
  closed_at?: string;
};
type BoardProspect = { id: string; kind: "prospect"; title: string; owner: PersonRef; started_at: string; matches_count: number };
type Stage = { stage: string; total: number; items: Array<BoardCase | BoardProspect> };

const STAGE: Record<string, { label: string; icon: string; description: string }> = {
  prospect: { label: "Prospect", icon: "app/icon-search-brand-20", description: "A hunch, no alert yet. Hunt before it becomes a loss." },
  investigate: { label: "Investigate", icon: "app/icon-folder-high-16", description: "Gathering evidence and protecting money." },
  decide: { label: "Decide", icon: "app/icon-check-square-medium-16", description: "Waiting on supervisor sign-off." },
  monitor: { label: "Monitor", icon: "app/icon-activity-info-22", description: "Closed, but we watch for a repeat for 30-90 days." },
  closed: { label: "Closed", icon: "app/icon-check-circle-success-22", description: "This week. Outcome final." },
};
/** The board has one column for Investigate and Act (protecting money is part of investigating). */
const COLUMN: Record<string, string> = { act: "investigate" };

const dayOf = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
/** 16:00 today, “tmrw”, or “22 Oct”. */
function dueText(iso: string, now: number) {
  if (dayOf(iso) === dayOf(now)) return formatClock(iso);
  if (dayOf(iso) === dayOf(now + 86_400_000)) return "tmrw";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
}
/** “Today”, a weekday within the week, then “12 Oct”. */
function closedText(iso: string, now: number) {
  if (dayOf(iso) === dayOf(now)) return "Today";
  if (now - Date.parse(iso) < 6 * 86_400_000) return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
}
function slaText(iso: string, now: number) {
  const left = Date.parse(iso) - now;
  return `SLA ${Math.max(1, Math.round(left / 3_600_000))}${left > 86_400_000 ? "d" : "h"}`;
}

/** Badge and note under the title, by stage. */
function cardFace(item: BoardCase | BoardProspect, now: number): { badge: string; tone: BadgeTone; owner: PersonRef | null; money: Money | null; note: string } {
  if (item.kind === "prospect") {
    return { badge: "Hunch", tone: "neutral", owner: item.owner, money: null, note: `${item.matches_count} ${item.matches_count === 1 ? "match" : "matches"} found` };
  }
  const money = item.money_at_stake.amount_minor ? item.money_at_stake : null;
  const base = { owner: item.assignee, money };
  if (item.stage === "monitor") return { ...base, badge: "Watching", tone: "info", note: item.watch_days_left != null ? `${item.watch_days_left} days left` : "" };
  if (item.stage === "closed") return { ...base, badge: "Closed", tone: "success", note: item.closed_at ? closedText(item.closed_at, now) : "" };
  if (item.stage === "decide") {
    const note = item.reviewer && item.decision_due_at ? `${item.reviewer.name.split(" ")[0]} · due ${dueText(item.decision_due_at, now)}` : item.sla_due_at ? slaText(item.sla_due_at, now) : "";
    return { ...base, badge: "Pending", tone: "medium", note };
  }
  return { ...base, badge: String(item.risk_score), tone: item.risk_score >= 90 ? "critical" : "high", note: item.sla_due_at ? slaText(item.sla_due_at, now) : "" };
}

/** G2 · The stage board. TODO(api): moving a card (PATCH stage on drop) isn’t in 0.2. */
export function CaseBoard() {
  const now = useNow();
  const { data, isLoading } = useApi<{ stages: Stage[] }>("/cases?group_by=stage");
  const columns = useMemo(() => {
    const out = new Map<string, Stage>();
    for (const s of data?.stages ?? []) {
      const id = COLUMN[s.stage] ?? s.stage;
      const col = out.get(id);
      out.set(id, col ? { stage: id, total: col.total + s.total, items: [...col.items, ...s.items] } : { ...s, stage: id });
    }
    return Array.from(out.values());
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-5 gap-4" aria-busy>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-[110px] w-full rounded-xl" />
            <Skeleton className="h-[110px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 items-start gap-4">
      {columns.map((s) => (
        <section key={s.stage} aria-label={STAGE[s.stage]?.label} className="flex min-w-0 flex-col gap-2.5">
          <header className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 text-title text-text-primary">
              <Icon name={STAGE[s.stage]?.icon ?? "app/icon-folder-high-16"} size={16} />
              {s.stage === "monitor" ? (
                <Link href="/cases/monitoring" className="rounded hover:underline">
                  {STAGE[s.stage].label}
                </Link>
              ) : (
                (STAGE[s.stage]?.label ?? s.stage)
              )}
              <span className="rounded-full bg-surface-sunken px-1.5 text-caption font-medium text-text-tertiary">{s.total}</span>
            </h3>
            <p className="min-h-10 text-caption text-text-secondary">{STAGE[s.stage]?.description}</p>
          </header>
          {s.items.map((item) => {
            const c = { id: item.id, title: item.title, ...cardFace(item, now) };
            return (
              <Link
                key={c.id}
                href={item.kind === "prospect" ? `/prospect/${c.id}` : `/cases/${c.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-base px-3.5 py-3 hover:border-border-default hover:shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-mono-s text-text-secondary">{c.id}</span>
                  <Badge label={c.badge} tone={c.tone} />
                </span>
                <span className="text-label-m text-text-primary">{c.title}</span>
                <span className="flex items-center gap-2 text-caption text-text-secondary">
                  {c.owner && <Avatar initials={c.owner.initials} />}
                  <span className="font-mono text-mono-s text-text-primary">{c.money ? formatMoney(c.money.amount_minor, c.money.currency) : "–"}</span>
                  {c.note}
                </span>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
