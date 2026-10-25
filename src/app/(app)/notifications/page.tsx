"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { NoticeRow, type Notice } from "@/components/shell/NotificationsPanel";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { useNow } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

/** All notifications — the same rows as the bell panel, without the cap. */
export default function NotificationsPage() {
  const router = useRouter();
  const now = useNow();
  const { mutate } = useSWRConfig();
  const { data } = useApi<{ data: Notice[]; unread: number }>("/notifications");
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
                onClick={async () => {
                  await apiFetch("POST", "/notifications/read-all").catch(() => undefined);
                  await mutate("/notifications");
                }}
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
