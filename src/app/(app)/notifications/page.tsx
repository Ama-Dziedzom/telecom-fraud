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

/** All notifications — the same rows as the bell panel, without the cap. */
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
              <Button
                variant="secondary"
                size="md"
                onClick={() => void markAllNotificationsRead(now).catch(() => undefined)}
              >
                Mark all read
              </Button>
            ) : undefined
          }
        />
        {!data ? (
          <Skeleton className="h-[300px] w-full rounded-xl" />
        ) : data.data.length === 0 ? (
          <EmptyState icon="app/icon-check-circle-success-22" tone="success" title="You’re all caught up" className="min-h-[260px]">
            New mentions, sign-off decisions and SLA warnings will show here.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base [&>button:first-child]:border-t-0">
            {data.data.map((n) => (
              <NoticeRow key={n.id} n={n} now={now} onOpen={() => router.push(n.link)} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
