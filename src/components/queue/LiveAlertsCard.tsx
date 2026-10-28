"use client";

import { Card, CardLink, Skeleton } from "@/components/app/Card";
import { SeverityBadge } from "@/components/app/indicators";
import { Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { Alert, Notification } from "@/lib/api/fd";
import type { ShiftHandover } from "@/lib/api/local";
import type { FeedState } from "@/lib/api/stream";
import { cn } from "@/lib/cn";
import { formatClock, formatClockOrDay } from "@/lib/time";
import Link from "next/link";

/** Live alert item (1319:168932) — severity pill + title, then number · region · time, and Triage. */
function LiveAlertItem({ a, arrived }: { a: Alert; arrived: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-border-default py-3 last:border-b-0",
        arrived && "animate-row-arrive motion-reduce:animate-none",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex min-w-0 items-center gap-2">
          <SeverityBadge severity={a.severity} />
          <span className="truncate text-label-s text-text-primary">{a.title}</span>
        </p>
        <p className="truncate text-caption text-text-tertiary">
          {a.subscriber.msisdn} · {a.region} · {formatClock(a.created_at)}
        </p>
      </div>
      <ButtonLink href={`/alerts?alert=${a.id}`} variant="secondary" size="sm">
        Triage
      </ButtonLink>
    </li>
  );
}

/** A1 · My queue · Live alerts mini feed (newest four). */
export function LiveAlertsCard({ alerts, total, loading, feed }: { alerts: Alert[]; total: number; loading: boolean; feed: FeedState }) {
  return (
    <Card title="Live alerts" aside={total > 0 && <CardLink href="/alerts">See all {total}</CardLink>}>
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <p className="pb-1 text-body-s text-text-secondary">No open alerts right now.</p>
      ) : (
        <ul className="-mt-1 -mb-2 flex flex-col">
          {alerts.slice(0, 4).map((a) => (
            <LiveAlertItem key={a.id} a={a} arrived={feed.arrived.has(a.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * A4 · Live feed delayed — a page banner above the columns. Alerts keep
 * showing; the banner says how far behind they are.
 */
export function FeedDelayBanner({ feed, operator, now }: { feed: FeedState; operator: string; now: number }) {
  if (feed.status === "live") return null;
  if (feed.status === "paused") {
    return (
      <Banner
        tone="warning"
        title="Live alerts are paused"
        action={
          <Button variant="secondary" size="sm" onClick={() => feed.setPaused(false)}>
            Resume
          </Button>
        }
      >
        You paused the feed on Live alerts. New alerts won’t appear until you resume it.
      </Banner>
    );
  }
  const last = feed.lastEventAt ?? feed.since;
  const behind = last ? Math.max(1, Math.round((now - last) / 60_000)) : null;
  return (
    <Banner tone="warning" title={behind ? `${operator} live feed is ${behind} min behind` : `${operator} live feed is delayed`}>
      {last ? `Last event received ${formatClock(last)}. ` : ""}New alerts may arrive late.
    </Banner>
  );
}

/** Handover note (1319:168950) — who and when, then the note. */
export function ShiftHandoverCard({ handover, now }: { handover: ShiftHandover; now: number }) {
  const shift = handover.shift.name[0].toUpperCase() + handover.shift.name.slice(1);
  return (
    <Card title="Shift handover">
      <div className="flex flex-col gap-2 pt-1 pb-1">
        <p className="flex items-center gap-2">
          <Avatar initials={handover.from.initials} />
          <span className="text-body-s text-text-primary">{handover.from.name}</span>
          <span className="text-caption text-text-tertiary">
            {shift} shift · {formatClockOrDay(handover.at, now)}
          </span>
        </p>
        <p className="text-body-s text-text-primary">{handover.note}</p>
      </div>
    </Card>
  );
}

/** Update item (1319:168947) — one line per notification, time on the right. */
export function UpdatesCard({ notifications, now }: { notifications: Notification[]; now: number }) {
  return (
    <Card title="Updates for you" id="updates">
      <ul className="-mt-1 -mb-2 flex flex-col">
        {notifications.slice(0, 3).map((n) => (
          <li key={n.id} className="border-b border-border-default last:border-b-0">
            <Link href={n.link} className="flex min-h-11 items-center gap-3 py-3 hover:text-text-brand">
              <span className="min-w-0 flex-1 text-body-s text-text-primary">{n.title}</span>
              <span className="shrink-0 text-caption text-text-tertiary">{formatClockOrDay(n.at, now)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
