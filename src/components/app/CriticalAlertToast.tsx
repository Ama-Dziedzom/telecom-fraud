"use client";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAutoDismiss } from "@/components/ui/Toast";
import { useAlert } from "@/lib/api/fd";
import type { FeedState } from "@/lib/api/stream";
import { formatClock, formatMoney } from "@/lib/time";
import { usePathname } from "next/navigation";

/**
 * B3 · Critical alert, anywhere in the app — the Critical alert card,
 * bottom-right, stacked above toasts. A critical alert that opened a case
 * interrupts whatever the analyst is doing (Live alerts shows its own banner
 * instead). The pill carries the colour. Open goes to the case; Later and ×
 * leave it in Needs you now. Like a toast, it goes on its own after 15 s
 * (paused while hovered or focused); that counts as Later.
 */
export function CriticalAlertToast({ feed }: { feed: FeedState }) {
  const pathname = usePathname();
  const event = feed.critical;
  const { data: alert } = useAlert(event && pathname !== "/alerts" ? event.id : null);
  if (!event || !alert || pathname === "/alerts" || pathname.startsWith(`/cases/${event.case_id}`)) return null;
  return <CriticalAlertCard key={event.id} feed={feed} event={event} alert={alert} />;
}

function CriticalAlertCard({
  feed,
  event,
  alert,
}: {
  feed: FeedState;
  event: NonNullable<FeedState["critical"]>;
  alert: NonNullable<ReturnType<typeof useAlert>["data"]>;
}) {
  const pause = useAutoDismiss(15_000, feed.dismissCritical);

  const outLine = alert.money_out ? `${formatMoney(alert.money_out.amount_minor, alert.money_out.currency)} out` : null;

  return (
    <div
      role="alert"
      {...pause}
      className="fixed right-6 bottom-6 z-50 flex w-[400px] max-w-[calc(100vw-32px)] animate-[toast-in_200ms_ease-out] flex-col gap-2 rounded-lg border border-border-default bg-surface-base py-4 pr-3 pl-5 shadow-[0_24px_24px_rgb(15_23_42/0.2)] motion-reduce:animate-none"
    >
      <div className="flex items-center gap-2">
        <Badge label={`Critical · ${alert.risk_score}`} tone="critical" />
        <span className="min-w-0 flex-1 truncate text-caption text-text-tertiary">
          Case {event.case_id} opened · {formatClock(alert.created_at)}
        </span>
        <button
          type="button"
          onClick={feed.dismissCritical}
          aria-label="Dismiss"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-sunken"
        >
          <Icon name="app/icon-x-secondary-16" size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-0.5 pr-2">
        <p className="text-title text-text-primary">{alert.title}</p>
        <p className="text-body-s text-text-secondary">
          {[outLine, alert.subscriber.msisdn, "assigned to you"].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex gap-2 pt-1">
        <ButtonLink href={`/cases/${event.case_id}`} size="sm" onClick={feed.dismissCritical}>
          Open {event.case_id}
        </ButtonLink>
        <Button variant="ghost" size="sm" onClick={feed.dismissCritical}>
          Later
        </Button>
      </div>
    </div>
  );
}
