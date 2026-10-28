"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { NoticeRow } from "@/components/shell/NotificationsPanel";
import { Button } from "@/components/ui/Button";
import { markAllNotificationsRead, useNotifications } from "@/lib/api/fd";
import { useNow } from "@/lib/time";
import { useRouter } from "next/navigation";

/** I3 · All notifications — the same rows as the bell popover, without the cap. */
export default function NotificationsPage() {
  const router = useRouter();
  const now = useNow();
  const { data } = useNotifications();
  return (
    <>
      <AppHeader section="Account" title="Notifications" />
      <PageBody>
        <PageHead
          title="Notifications"
          subtitle="Mentions, sign-off decisions, SLA warnings and system updates."
          actions={
            data?.unread ? (
              <Button variant="secondary" size="md" onClick={() => void markAllNotificationsRead(now).catch(() => undefined)}>
                Mark all read
              </Button>
            ) : undefined
          }
        />
        {!data ? (
          <Skeleton className="h-[300px] w-full rounded-lg" />
        ) : data.data.length === 0 ? (
          <EmptyState icon="app/icon-check-circle-tertiary-18" title="You’re all caught up" className="min-h-[260px]">
            New mentions, sign-off decisions and SLA warnings show up here.
          </EmptyState>
        ) : (
          <div className="flex flex-col divide-y divide-border-default overflow-hidden rounded-lg border border-border-default bg-surface-base py-1">
            {data.data.map((n) => (
              <NoticeRow key={n.id} n={n} now={now} onOpen={() => router.push(n.link)} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
