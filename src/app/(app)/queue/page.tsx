"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead, useFeed, useShell } from "@/components/app/AppShell";
import { Card, CardLink, Skeleton, Tabs } from "@/components/app/Card";
import { CaseStatusBadge, RiskScore, riskTone, SeverityBadge, SlaLabel } from "@/components/app/indicators";
import { FirstDay } from "@/components/queue/FirstDay";
import { HandoverModal } from "@/components/queue/HandoverModal";
import { LiveAlertsCard } from "@/components/queue/LiveAlertsCard";
import { NightHandoverDrawer } from "@/components/queue/NightHandoverDrawer";
import { Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import {
  fraudTypeLabel,
  isOpenAlert,
  useAlerts,
  useMyCases,
  useMyInsights,
  useNotifications,
  type CaseStatus,
  type CaseSummary,
} from "@/lib/api/fd";
import {
  handoverKey,
  markNightHandoverSeen,
  nightHandoverKey,
  shiftName,
  useLatestHandover,
  useStored,
  type SubmittedHandover,
} from "@/lib/api/local";
import { cn } from "@/lib/cn";
import { formatClock, formatClockOrDay, formatDay, greeting, useNow } from "@/lib/time";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SOON_MS = 30 * 60_000;

/** Cases that need action now: due within 30 min, sent back, or not yet opened — by SLA, then risk. */
function needsYou(cases: CaseSummary[], now: number) {
  return cases
    .filter((c) => c.status === "sent_back" || c.status === "new" || Date.parse(c.sla_due_at) - now < SOON_MS)
    .sort((a, b) => Date.parse(a.sla_due_at) - Date.parse(b.sla_due_at) || b.risk_score - a.risk_score)
    .slice(0, 3);
}

const NEED_ACTION: Partial<Record<CaseStatus, string>> = { sent_back: "Fix", new: "Start" };

function NeedsYouNow({ cases, now }: { cases: CaseSummary[]; now: number }) {
  const items = needsYou(cases, now);
  return (
    <Card
      title="Needs you now"
      icon="app/icon-timer-secondary-18"
      aside={<span className="text-caption text-text-tertiary">Sorted by SLA, then risk</span>}
    >
      {items.length === 0 ? (
        <p className="py-2 text-body-s text-text-secondary">Nothing is due in the next 30 minutes.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((c, i) => {
            const sentBack = c.status === "sent_back";
            return (
              <li key={c.id} className="flex items-center gap-3.5 border-b border-border-subtle py-3.5 last:border-b-0">
                {/* Urgency bar: high for send-backs, medium for SLA pressure. */}
                <span aria-hidden className={cn("h-10 w-1 shrink-0 rounded-[2px]", sentBack ? "bg-high-fg" : "bg-medium-fg")} />
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <p className="flex items-center gap-2 text-body-m">
                    <span className="font-mono text-mono-m text-text-primary">{c.id}</span>
                    <span className="truncate text-text-secondary">{c.title}</span>
                  </p>
                  {sentBack ? (
                    <span className="flex items-center gap-1.5 text-label-s text-high-fg">
                      <Icon name="app/icon-refresh-high-14" size={14} />
                      {c.reviewer ? `Sent back by ${c.reviewer.name.split(" ")[0]}` : "Sent back · changes requested"}
                    </span>
                  ) : (
                    <SlaLabel dueAt={c.sla_due_at} now={now} prefix={c.status === "new" ? "New · not yet opened · " : "SLA · "} />
                  )}
                </div>
                <span className="flex-1" />
                <SeverityBadge severity={riskTone(c.risk_score)} />
                <ButtonLink
                  href={`/cases/${c.id}`}
                  size="sm"
                  variant={i === 0 ? "primary" : "secondary"}
                  iconRight={<Icon name={i === 0 ? "app/icon-arrow-right-white-16" : "app/icon-arrow-right-primary-16"} size={16} />}
                >
                  {NEED_ACTION[c.status] ?? "Continue"}
                </ButtonLink>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

type CaseTab = "all" | Exclude<CaseStatus, "closed" | "new">;

function CasesTable({ cases, now }: { cases: CaseSummary[]; now: number }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      <table className="w-full table-fixed text-left">
        <thead className="border-b border-border-subtle bg-surface-raised">
          <tr className="text-overline text-text-tertiary uppercase">
            <th className="w-[104px] py-[11px] pl-5 font-bold">Case</th>
            <th className="w-[166px] py-[11px] pl-4 font-bold">Subscriber</th>
            <th className="py-[11px] pl-4 font-bold">Type</th>
            <th className="w-[96px] py-[11px] pl-4 font-bold">Risk</th>
            <th className="w-[156px] py-[11px] pl-4 font-bold">Status</th>
            <th className="w-[146px] py-[11px] pr-5 pl-4 font-bold">SLA</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr
              key={c.id}
              onClick={() => router.push(`/cases/${c.id}`)}
              className="cursor-pointer border-b border-border-subtle bg-surface-base last:border-b-0 hover:bg-[#fbfaff]"
            >
              <td className="py-3.5 pl-5">
                <Link href={`/cases/${c.id}`} className="rounded font-mono text-mono-m text-text-primary">
                  {c.id}
                </Link>
              </td>
              <td className="truncate py-3.5 pl-4 font-mono text-mono-m text-text-secondary">{c.subscriber.msisdn}</td>
              <td className="truncate py-3.5 pl-4 text-body-m text-text-primary">{fraudTypeLabel(c.fraud_type)}</td>
              <td className="py-3.5 pl-4"><RiskScore score={c.risk_score} /></td>
              <td className="py-3.5 pl-4"><CaseStatusBadge status={c.status} /></td>
              <td className="py-3.5 pr-5 pl-4"><SlaLabel dueAt={c.sla_due_at} now={now} /></td>
            </tr>
          ))}
          {cases.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-6 text-center text-body-s text-text-secondary">No cases here.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MyOpenCases({ cases, now }: { cases: CaseSummary[]; now: number }) {
  const [tab, setTab] = useState<CaseTab>("all");
  const count = (s: CaseStatus) => cases.filter((c) => c.status === s).length;
  return (
    <Card title="My open cases" aside={<CardLink href="/cases">View in Cases</CardLink>}>
      <Tabs
        label="Filter my cases"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "all", label: "All", count: cases.length },
          { id: "investigating", label: "Investigating", count: count("investigating") },
          { id: "escalated", label: "Escalated", count: count("escalated") },
          { id: "sent_back", label: "Sent back", count: count("sent_back") },
          { id: "pending_decision", label: "Pending decision", count: count("pending_decision") },
        ]}
      />
      <CasesTable cases={tab === "all" ? cases : cases.filter((c) => c.status === tab)} now={now} />
    </Card>
  );
}

/** A2 · Loading — keeps the layout with skeleton cards. */
function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-border-subtle bg-surface-base px-5 py-[18px]" aria-hidden>
      <Skeleton className="h-3.5 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-1" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A1–A7 · My queue (default, loading, first day, feed delayed, hand over, submitted, night handover) */
export default function MyQueuePage() {
  const now = useNow();
  const { user } = useShell();
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
  const toast = useToast();
  const submitted = useStored<SubmittedHandover>(handoverKey(now));
  const nightRead = useStored<boolean>(nightHandoverKey(now));

  const loading = casesLoading || alertsLoading;
  const cases = casesPage?.data ?? [];
  const openAlerts = (alertsPage?.data ?? []).filter(isOpenAlert);
  const firstDay = !casesLoading && cases.length === 0;
  const dueSoon = cases.filter((c) => {
    const left = Date.parse(c.sla_due_at) - now;
    return left >= 0 && left < SOON_MS;
  }).length;
  const firstName = user?.name.split(" ")[0] ?? "";

  const subtitle = loading
    ? "Loading your queue…"
    : firstDay
      ? `First shift at ${"Kasa Mobile"} · Fraud Analyst`
      : [formatDay(now), user?.shift && `Shift ${user.shift}`, `${dueSoon} ${dueSoon === 1 ? "thing" : "things"} due in the next 30 min`]
          .filter(Boolean)
          .join(" · ");

  return (
    <>
      <AppHeader section="Work" title="My queue" />
      <PageBody>
        <PageHead
          title={firstDay ? `Welcome, ${firstName}` : firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
          subtitle={subtitle}
          actions={
            <>
              {firstDay ? (
                <ButtonLink href="#tour" variant="secondary" size="md" iconLeft={<Icon name="app/icon-activity-18" size={18} />}>
                  Take the tour
                </ButtonLink>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={loading}
                  onClick={() => setHandoverOpen(true)}
                  iconLeft={<Icon name="app/icon-users-primary-18" size={18} />}
                >
                  {submitted ? "Edit handover" : "Hand over shift"}
                </Button>
              )}
              <ButtonLink href="/alerts" size="md" iconLeft={<Icon name="app/icon-alert-triangle-white-18" size={18} />}>
                {loading ? "Open live alerts" : `Open live alerts · ${openAlerts.length}`}
              </ButtonLink>
            </>
          }
        />

        {submitted && (
          <Banner tone="success" title={`Handover submitted ${formatClock(submitted.at)}`}>
            {submitted.to.name} takes over at {formatClock(submitted.starts_at)}. You can edit it until they open it.
          </Banner>
        )}

        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {loading ? (
              <>
                <SkeletonCard rows={3} />
                <SkeletonCard rows={5} />
              </>
            ) : firstDay ? (
              <FirstDay />
            ) : (
              <>
                <NeedsYouNow cases={cases} now={now} />
                <MyOpenCases cases={cases} now={now} />
              </>
            )}
          </div>

          <div className="flex w-[420px] shrink-0 flex-col gap-4">
            {loading ? (
              <>
                <SkeletonCard rows={4} />
                <SkeletonCard rows={2} />
              </>
            ) : (
              <>
                <LiveAlertsCard
                  alerts={openAlerts}
                  total={openAlerts.length}
                  loading={alertsLoading}
                  feed={feed}
                  now={now}
                  onRetry={feed.reconnect}
                />
                {handover && (
                  <Card title="Shift handover" icon="app/icon-users-secondary-18">
                    <div className="flex flex-col gap-2">
                      <p className="flex items-center gap-2 text-caption text-text-secondary">
                        <Avatar initials={handover.from.initials} />
                        {handover.from.name} · {handover.shift.name} shift · {formatClockOrDay(handover.at, now)}
                      </p>
                      <p className="text-body-s text-text-primary">{handover.note}</p>
                    </div>
                  </Card>
                )}
                <Card title="Updates for you" icon="app/icon-bell-secondary-18" id="updates">
                  <ul className="flex flex-col">
                    {(notifications?.data ?? []).map((n) => (
                      <li key={n.id} className="border-b border-border-subtle last:border-b-0">
                        <Link href={n.link} className="flex items-center justify-between gap-3 py-[9px]">
                          <span className="text-body-s text-text-secondary">{n.title}</span>
                          <span className="shrink-0 text-caption text-text-tertiary">{formatClockOrDay(n.at, now)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}
          </div>
        </div>
      </PageBody>

      {user?.next_shift && !casesLoading && (
        <HandoverModal
          key={handoverOpen ? "open" : "closed"}
          open={handoverOpen}
          onClose={() => {
            setHandoverOpen(false);
            if (params.get("handover")) nav.replace("/queue");
          }}
          cases={cases}
          next={user.next_shift}
          resolvedToday={mine?.resolved}
          onSubmitted={(h) => {
            setHandoverOpen(false);
            toast({
              tone: "success",
              title: `Handover sent to ${h.to.name.split(" ")[0]}`,
              body: `${cases.length} cases · ${h.cases.filter((c) => c.choice === "hand_over").length} handed to the ${shiftName(user.next_shift!.shift)} shift.`,
              action: { label: "View", onClick: () => setHandoverOpen(true) },
            });
          }}
        />
      )}

      {handover && !handover.read_at && !firstDay && (
        <NightHandoverDrawer
          open={nightRead !== true && !loading}
          handover={handover}
          cases={cases}
          alerts={openAlerts}
          myShift={user?.shift ? shiftName(user.shift) : "day"}
          now={now}
          onDone={() => markNightHandoverSeen(now)}
        />
      )}

    </>
  );
}
