"use client";

import { Card, CardLink, Skeleton } from "@/components/app/Card";
import { SeverityBadge } from "@/components/app/indicators";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Alert } from "@/lib/api/fd";
import type { FeedState } from "@/lib/api/stream";
import { cn } from "@/lib/cn";
import { formatAgo, formatClock } from "@/lib/time";

/** Live alerts mini feed on My queue, with the A4 “feed paused” state. */
export function LiveAlertsCard({
  alerts,
  total,
  loading,
  feed,
  now,
  onRetry,
}: {
  alerts: Alert[];
  total: number;
  loading: boolean;
  feed: FeedState;
  now: number;
  onRetry: () => void;
}) {
  const newCount = alerts.filter((a) => a.status === "new").length;
  const paused = feed.status !== "live";

  return (
    <Card
      title="Live alerts"
      icon="app/icon-alert-triangle-secondary-18"
      aside={
        paused ? (
          <Badge label="Delayed" tone="medium" dot />
        ) : (
          newCount > 0 && <Badge label={`${newCount} new`} tone="critical" dot />
        )
      }
    >
      {paused && (
        <div className="flex flex-col items-center gap-2.5 px-2 py-6 text-center" role="status">
          <span className="flex size-11 items-center justify-center rounded-xl bg-medium-bg">
            <Icon name="app/icon-wifi-off-medium-22" size={22} />
          </span>
          <p className="text-label-m text-text-primary">
            Feed paused{feed.since ? ` at ${formatClock(feed.since)}` : ""}
          </p>
          <p className="w-[300px] text-body-s text-text-secondary">Reconnecting… new alerts will appear automatically.</p>
          <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
            Retry now
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col">
          {alerts.slice(0, 4).map((a) => (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-3 border-b border-border-subtle py-3 last:border-b-0",
                feed.arrived.has(a.id) && "animate-row-arrive motion-reduce:animate-none",
              )}
            >
              <div className="flex min-w-0 flex-col gap-[3px]">
                <p className="flex items-center gap-2">
                  <SeverityBadge severity={a.severity} />
                  <span className="truncate text-label-s text-text-primary">{a.title}</span>
                </p>
                <p className="truncate text-caption text-text-secondary">
                  {a.subscriber.msisdn} · {a.region} · {formatAgo(a.created_at, now)}
                </p>
              </div>
              <span className="flex-1" />
              <ButtonLink href={`/alerts?alert=${a.id}`} variant="secondary" size="sm">
                Triage
              </ButtonLink>
            </li>
          ))}
          {alerts.length === 0 && <li className="py-2 text-body-s text-text-secondary">No open alerts right now.</li>}
        </ul>
      )}
      {!paused && <CardLink href="/alerts">See all {total} alerts</CardLink>}
    </Card>
  );
}
