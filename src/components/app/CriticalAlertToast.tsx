"use client";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAlert } from "@/lib/api/fd";
import type { FeedState } from "@/lib/api/stream";
import { formatMoney } from "@/lib/time";
import { usePathname } from "next/navigation";

/**
 * B3 · Critical alert, anywhere in the app. A critical alert that opened a
 * case interrupts whatever the analyst is doing (Live alerts shows its own
 * banner instead). Stays until they open the case or choose “Later”.
 */
export function CriticalAlertToast({ feed }: { feed: FeedState }) {
  const pathname = usePathname();
  const event = feed.critical;
  const { data: alert } = useAlert(event && pathname !== "/alerts" ? event.id : null);
  if (!event || !alert || pathname === "/alerts" || pathname.startsWith(`/cases/${event.case_id}`)) return null;

  const payments = alert.what_happened.find((s) => s.kind === "payments_out");
  const outLine =
    payments?.detail ?? (alert.money_out ? `${formatMoney(alert.money_out.amount_minor, alert.money_out.currency)} out` : null);

  return (
    <div
      role="alert"
      className="fixed right-12 bottom-26 z-50 flex w-[460px] max-w-[calc(100vw-32px)] animate-[toast-in_200ms_ease-out] items-start gap-3.5 overflow-hidden rounded-xl border border-critical-border bg-surface-base px-[18px] py-4 shadow-lg motion-reduce:animate-none"
    >
      <span aria-hidden className="w-1 self-stretch rounded-[2px] bg-critical-fg" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="flex items-center gap-2">
          <Badge label={`Critical · ${alert.risk_score} · auto-case`} tone="critical" dot />
          <span className="text-caption text-text-tertiary">just now</span>
        </p>
        <p className="text-title text-text-primary">{alert.title}</p>
        <p className="truncate text-body-s text-text-secondary">
          {[outLine, alert.subscriber.msisdn].filter(Boolean).join(" · ")}
        </p>
        <div className="flex gap-2">
          <ButtonLink
            href={`/cases/${event.case_id}`}
            size="sm"
            onClick={feed.dismissCritical}
            iconLeft={<Icon name="app/icon-arrow-right-white-16" size={16} />}
          >
            Open {event.case_id}
          </ButtonLink>
          <Button variant="ghost" size="sm" onClick={feed.dismissCritical}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
