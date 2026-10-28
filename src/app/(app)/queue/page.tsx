"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead, useFeed, useShell } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { FirstDay } from "@/components/queue/FirstDay";
import { HandoverModal } from "@/components/queue/HandoverModal";
import { FeedDelayBanner, LiveAlertsCard, ShiftHandoverCard, UpdatesCard } from "@/components/queue/LiveAlertsCard";
import { MyOpenCases, MyOpenCasesSkeleton } from "@/components/queue/MyOpenCases";
import { NeedsYouNow } from "@/components/queue/NeedsYouNow";
import { NightHandoverDrawer } from "@/components/queue/NightHandoverDrawer";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { isOpenAlert, useAlerts, useApi, useMyCases, useMyInsights, useNotifications, type PersonRef } from "@/lib/api/fd";
import {
  handoverKey,
  markNightHandoverSeen,
  nightHandoverKey,
  useLatestHandover,
  useStored,
  type SubmittedHandover,
} from "@/lib/api/local";
import { useOperatorName } from "@/lib/auth/session";
import { formatClock, greeting, TZ, useNow } from "@/lib/time";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** 09:58, or null for a missing or unparseable time (never “Invalid Date”). */
function clockOf(t: string | number | null | undefined) {
  if (t === null || t === undefined) return null;
  const ms = typeof t === "number" ? t : Date.parse(t);
  return Number.isNaN(ms) ? null : formatClock(ms);
}

/** “Tuesday 20 October · your shift ends at 16:00” (“in 22 min” in the last hour). */
function headerMeta(now: number, shift: string | undefined) {
  const day = new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  const m = shift?.match(/(\d\d):(\d\d)-(\d\d):(\d\d)/);
  if (!m) return day;
  const d = new Date(now);
  const local = d.getUTCHours() * 60 + d.getUTCMinutes(); // Accra is UTC+0
  const start = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4] || 1440;
  if (local < start || local >= end) return day;
  const left = end - local;
  return `${day} · your shift ends ${left <= 60 ? `in ${left} min` : `at ${m[3]}:${m[4]}`}`;
}

/** “FD-3050 and FD-3047” · “FD-3050, FD-3047 and FD-3041” */
const listIds = (ids: string[]) => (ids.length < 2 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`);

/** A2 · Loading — the cards keep their places. */
function SkeletonCard() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4 rounded-lg border border-border-default bg-surface-base px-6 py-6">
      <Skeleton className="mb-3 h-3.5 w-32 rounded-full" />
      <Skeleton className="h-2.5 w-[80%] max-w-[330px] rounded-full" />
      <Skeleton className="h-2.5 w-[68%] max-w-[280px] rounded-full" />
      <Skeleton className="h-2.5 w-[56%] max-w-[205px] rounded-full" />
    </div>
  );
}

/** A1–A8 · My queue (default, loading, first day, feed delayed, hand over, handover sent, night handover, handover off). */
export default function MyQueuePage() {
  const now = useNow();
  const { user } = useShell();
  const operator = useOperatorName() ?? "Kasa Mobile";
  const { data: casesPage, isLoading: casesLoading } = useMyCases();
  const { data: alertsPage, isLoading: alertsLoading } = useAlerts();
  const { data: notifications } = useNotifications();
  const { data: mine } = useMyInsights();
  const { data: handover } = useLatestHandover();
  const feed = useFeed();
  const params = useSearchParams();
  const nav = useRouter();
  // ⌘ Shift H and the profile menu land here with ?handover=1.
  const [handoverState, setHandoverOpen] = useState(false);
  const handoverOpen = handoverState || params.get("handover") === "1";
  const submitted = useStored<SubmittedHandover>(handoverKey(now));
  // A6 · the confirmation shows right after sending; later visits just offer “Edit handover”.
  const [justSent, setJustSent] = useState(false);
  const nightRead = useStored<boolean>(nightHandoverKey(now));

  const loading = casesLoading || alertsLoading;
  const allCases = casesPage?.data ?? [];
  // Handed-over cases move to the next shift’s queue (A6).
  const handedIds = submitted?.cases?.filter((c) => c.choice === "hand_over").map((c) => c.case_id) ?? [];
  const cases = allCases.filter((c) => !handedIds.includes(c.id));
  const openAlerts = (alertsPage?.data ?? []).filter(isOpenAlert);
  const firstDay = !casesLoading && allCases.length === 0;
  const firstName = user?.name.split(" ")[0] ?? "";
  // A3 names the supervisor who assigns the first cases.
  const { data: profile } = useApi<{ managed: { supervisor: PersonRef } }>(firstDay ? "/me/profile" : null);
  const next = user?.next_shift ?? null;

  // A6 · who takes over and when: today’s /me first, then what was stored when it was sent.
  const takerName = next?.user.name ?? submitted?.to?.name;
  const takerAt = clockOf(next?.starts_at) ?? clockOf(submitted?.starts_at);
  const sentAt = clockOf(submitted?.submitted_at) ?? clockOf(submitted?.at);

  return (
    <>
      <AppHeader section="Work" title="My queue" />
      <PageBody>
        <PageHead
          title={firstDay ? `Welcome, ${firstName}` : firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
          subtitle={headerMeta(now, user?.shift)}
          actions={
            // A8 · handover is off for teams without a next shift.
            next && (
              <Button variant="secondary" size="md" onClick={() => setHandoverOpen(true)}>
                {submitted ? "Edit handover" : "Hand over shift"}
              </Button>
            )
          }
        />

        {submitted && justSent && (
          <Banner tone="success" title={sentAt ? `Handover sent ${sentAt}` : "Handover sent"}>
            {handedIds.length ? `${listIds(handedIds)} ${handedIds.length === 1 ? "goes" : "go"} to ` : "Your note goes to "}
            {takerName ?? "the next shift"}
            {takerAt ? ` at ${takerAt}` : ""}. You can edit it until they open it.
          </Banner>
        )}

        <FeedDelayBanner feed={feed} operator={operator} now={now} />

        <div className="flex items-start gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {loading ? (
              <>
                <SkeletonCard />
                <MyOpenCasesSkeleton />
              </>
            ) : firstDay ? (
              <FirstDay
                supervisor={profile?.managed.supervisor.name}
                shiftStart={user?.shift?.slice(0, 5)}
                action={
                  <ButtonLink href="/alerts" variant="secondary" size="md">
                    View live alerts
                  </ButtonLink>
                }
              />
            ) : (
              <>
                <NeedsYouNow cases={cases} now={now} />
                <MyOpenCases cases={cases} now={now} />
              </>
            )}
          </div>

          <div className="flex w-[400px] shrink-0 flex-col gap-6">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <LiveAlertsCard
                  alerts={openAlerts}
                  total={alertsPage?.total ?? openAlerts.length}
                  loading={alertsLoading}
                  feed={feed}
                />
                {handover && <ShiftHandoverCard handover={handover} now={now} />}
                {!firstDay && !!notifications?.data.length && <UpdatesCard notifications={notifications.data} now={now} />}
              </>
            )}
          </div>
        </div>
      </PageBody>

      {next && !casesLoading && (
        <HandoverModal
          key={handoverOpen ? "open" : "closed"}
          open={handoverOpen}
          onClose={() => {
            setHandoverOpen(false);
            if (params.get("handover")) nav.replace("/queue");
          }}
          cases={allCases}
          next={next}
          resolvedToday={mine?.resolved}
          previous={submitted}
          onSubmitted={() => {
            setHandoverOpen(false);
            setJustSent(true);
            if (params.get("handover")) nav.replace("/queue");
          }}
        />
      )}

      {handover && !handover.read_at && !firstDay && (
        <NightHandoverDrawer
          open={nightRead !== true && !loading}
          handover={handover}
          cases={allCases}
          alerts={openAlerts}
          now={now}
          onDone={() => markNightHandoverSeen(now)}
        />
      )}
    </>
  );
}
