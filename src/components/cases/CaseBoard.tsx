"use client";

import { Skeleton } from "@/components/app/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useApi, type CaseSummary, type PersonRef, type SubscriberRef } from "@/lib/api/fd";
import { formatClock, formatMoney, formatSpan, TZ, useNow } from "@/lib/time";
import { localMsisdn } from "./CaseTable";
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
type BoardProspect = {
  id: string;
  kind: "prospect";
  title: string;
  owner: PersonRef;
  started_at: string;
  matches_count: number;
};
type Stage = {
  stage: string;
  total: number;
  items: Array<BoardCase | BoardProspect>;
};

const STAGE: Record<string, { label: string; description: string }> = {
  prospect: { label: "Prospect", description: "A hunch, no alert yet" },
  investigate: {
    label: "Investigate",
    description: "Gathering evidence, protecting money",
  },
  decide: { label: "Decide", description: "Waiting on supervisor sign-off" },
  monitor: { label: "Monitor", description: "Closed, watched for a repeat" },
  closed: { label: "Closed", description: "This week · outcome final" },
};
/** The board has one column for Investigate and Act (protecting money is part of investigating). */
const COLUMN: Record<string, string> = { act: "investigate" };

const dayOf = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
/** 16:00 today, “tmrw”, or “22 Oct”. */
function dueText(iso: string, now: number) {
  if (dayOf(iso) === dayOf(now)) return formatClock(iso);
  if (dayOf(iso) === dayOf(now + 86_400_000)) return "tmrw";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
}
/** “Today”, a weekday within the week, then “12 Oct”. */
function closedText(iso: string, now: number) {
  if (dayOf(iso) === dayOf(now)) return "Today";
  if (now - Date.parse(iso) < 6 * 86_400_000)
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: TZ,
    });
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
}
/** “SLA 18m”, “SLA 1h 40m”, “SLA breached”. */
function slaText(iso: string, now: number) {
  const left = Date.parse(iso) - now;
  return left < 0 ? "SLA breached" : `SLA ${formatSpan(left).replace(/ 00m$/, "")}`;
}
/** “opened 2 days ago”. */
function openedText(iso: string, now: number) {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  return days < 1 ? "opened today" : days === 1 ? "opened yesterday" : `opened ${days} days ago`;
}

/** Badge and the meta line under the title, by stage (the app writes these; the API sends codes and numbers). */
function cardFace(item: BoardCase | BoardProspect, now: number): { badge: string; tone: BadgeTone; meta: Array<string | null> } {
  if (item.kind === "prospect") {
    const found = item.matches_count ? `${item.matches_count} ${item.matches_count === 1 ? "match" : "matches"} found` : openedText(item.started_at, now);
    return {
      badge: "Hunch",
      tone: "neutral",
      meta: [item.owner.initials, found],
    };
  }
  const who = item.assignee?.initials ?? null;
  const money = item.money_at_stake.amount_minor ? formatMoney(item.money_at_stake.amount_minor, item.money_at_stake.currency) : null;
  if (item.stage === "monitor")
    return {
      badge: "No repeats",
      tone: "success",
      meta: [who, item.watch_days_left != null ? `${item.watch_days_left} days left` : null],
    };
  if (item.stage === "closed")
    return {
      badge: "Closed",
      tone: "success",
      meta: [who, item.closed_at ? closedText(item.closed_at, now) : null],
    };
  if (item.stage === "decide") {
    const due =
      item.reviewer && item.decision_due_at
        ? `${item.reviewer.name.split(" ")[0]}, due ${dueText(item.decision_due_at, now)}`
        : item.sla_due_at
          ? slaText(item.sla_due_at, now)
          : null;
    return { badge: "Pending", tone: "neutral", meta: [who, money, due] };
  }
  const tone: BadgeTone = item.risk_score >= 90 ? "critical" : item.risk_score >= 70 ? "high" : "medium";
  return {
    badge: tone === "critical" ? "Critical" : tone === "high" ? "High" : "Medium",
    tone,
    meta: [who, money, item.sla_due_at ? slaText(item.sla_due_at, now) : null],
  };
}

const matches = (item: BoardCase | BoardProspect, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const digits = s.replace(/\D/g, "");
  const msisdn = item.kind !== "prospect" && item.subscriber ? localMsisdn(item.subscriber.msisdn).replace(/\D/g, "") : "";
  return item.id.toLowerCase().includes(s) || item.title.toLowerCase().includes(s) || (!!digits && msisdn.includes(digits));
};

/** G2 · The stage board — one panel per stage, Case cards (1342:228523). TODO(api): moving a card (PATCH stage on drop) isn’t in 0.2. */
export function CaseBoard({ q = "" }: { q?: string }) {
  const now = useNow();
  const { data, isLoading } = useApi<{ stages: Stage[] }>("/cases?group_by=stage");
  const columns = useMemo(() => {
    const out = new Map<string, Stage>();
    for (const s of data?.stages ?? []) {
      const id = COLUMN[s.stage] ?? s.stage;
      const col = out.get(id);
      out.set(
        id,
        col
          ? {
              stage: id,
              total: col.total + s.total,
              items: [...col.items, ...s.items],
            }
          : { ...s, stage: id },
      );
    }
    return Array.from(out.values());
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-5 items-start gap-4" aria-busy>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg bg-surface-raised p-2.5">
            <Skeleton className="m-1 h-4 w-24" />
            <Skeleton className="m-1 h-3 w-36" />
            <Skeleton className="h-[88px] w-full rounded-lg" />
            <Skeleton className="h-[88px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 items-start gap-4">
      {columns.map((s) => {
        const items = s.items.filter((i) => matches(i, q));
        const more = q.trim() ? 0 : s.total - items.length;
        const label = STAGE[s.stage]?.label ?? s.stage;
        return (
          <section key={s.stage} aria-label={label} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised p-2.5">
            <header className="flex flex-col gap-1 px-1 pt-1 pb-1">
              <h3 className="flex items-center gap-2 text-label-s text-text-primary">
                {s.stage === "monitor" ? (
                  <Link href="/cases/monitoring" className="rounded hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
                <Badge label={String(s.total)} tone="neutral" />
              </h3>
              <p className="text-caption text-text-secondary">{STAGE[s.stage]?.description}</p>
            </header>
            {items.map((item) => {
              const face = cardFace(item, now);
              return (
                <Link
                  key={item.id}
                  href={item.kind === "prospect" ? `/prospect/${item.id}` : `/cases/${item.id}`}
                  className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-surface-base px-2.5 py-2.5 hover:border-border-strong"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-mono-m text-text-primary">{item.id}</span>
                    <Badge label={face.badge} tone={face.tone} />
                  </span>
                  <span className="text-body-s text-text-primary">{item.title.replace(/, /g, " · ")}</span>
                  <span className="text-caption text-text-secondary">{face.meta.filter(Boolean).join(" · ")}</span>
                </Link>
              );
            })}
            {more > 0 && <p className="px-1 pb-1 text-caption text-text-secondary">{more} more</p>}
          </section>
        );
      })}
    </div>
  );
}
