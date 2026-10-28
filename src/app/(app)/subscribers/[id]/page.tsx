"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card, CardMeta, Tabs } from "@/components/app/Card";
import {
  CardSkeleton,
  CaseHistoryRows,
  IdentityCard,
  localNumber,
  MobileMoneyCard,
  monthYear,
  OutflowChart,
  RecentActivity,
  SimDeviceCard,
  SimDevicesTab,
  StatTileSkeleton,
  SubscriberTiles,
  WhyHighRisk,
} from "@/components/subscriber/ProfileParts";
import { WatchModal } from "@/components/lookup/LookupModals";
import { GuideRow } from "@/components/help/GuideRow";
import { BehaviourView } from "@/components/subscriber/BehaviourView";
import { CallsTab } from "@/components/subscriber/CallsTab";
import { useAddCheckToCase } from "@/components/subscriber/CheckLayout";
import { PatternsView } from "@/components/subscriber/PatternsView";
import { RevealModal, revealPurpose } from "@/components/subscriber/RevealModal";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api/client";
import { useApi, useSubscriber, type Subscriber } from "@/lib/api/fd";
import { hide, useRevealed } from "@/lib/api/reveal";
import { useAudit } from "@/lib/api/subscribers";
import { formatClock, formatWhen, useNow } from "@/lib/time";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";

type Tab = "overview" | "activity" | "transactions" | "calls" | "sim" | "cases" | "audit";
const TABS: Tab[] = ["overview", "activity", "transactions", "calls", "sim", "cases", "audit"];
const PLAN: Record<Subscriber["plan"], string> = { prepaid: "prepaid", postpaid: "postpaid" };
/** What the Activity (C19) and Transactions (C26) tabs export and add to a case — as their standalone check pages do. */
const CHECK = {
  activity: { section: "Behaviour profile", evidenceTitle: "Behaviour profile: normal vs now", exportLabel: "Export" },
  transactions: { section: "Transaction patterns", evidenceTitle: "Transaction patterns", exportLabel: "Export chart" },
};
/** Sources Subscriber 360 reads from, as named in the C16 banner. */
const SOURCE: Record<string, { title: string; detail: string }> = {
  kyc: { title: "KYC registry didn’t respond", detail: "Identity details may be out of date. Everything else is live." },
  wallet: { title: "Mobile money didn’t respond", detail: "Wallet figures may be out of date. Everything else is live." },
};

function AuditTab({ id, now }: { id: string; now: number }) {
  const { data } = useAudit(id);
  const LABEL: Record<string, string> = {
    "pii.revealed": "Revealed personal details",
    "wallet.frozen": "Froze the wallet",
    "profile.viewed": "Opened this profile",
  };
  return (
    <Card title="Audit log" aside={<CardMeta>Every view and change is logged</CardMeta>}>
      <ul className="flex flex-col">
        {data?.data.map((e) => (
          <li key={e.id} className="flex h-[52px] items-center gap-3 border-b border-border-default last:border-b-0">
            <Avatar initials={e.actor.initials} />
            <span className="min-w-0 flex-1 truncate text-body-s text-text-primary">
              {e.actor.name} · {LABEL[e.action] ?? e.action}
              {e.reason ? <span className="text-text-secondary"> · {e.reason}</span> : null}
            </span>
            <span className="text-caption text-text-tertiary">{formatWhen(e.at, now, { withTime: true })}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** C12–C18 · Subscriber 360 */
export default function SubscriberPage() {
  const { id } = useParams<{ id: string }>();
  const now = useNow(1000);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const { data: sub, error } = useSubscriber(id);
  const revealed = useRevealed(id);
  const [revealOpen, setRevealOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [justWatched, setJustWatched] = useState(false);
  const { data: watchlist } = useApi<{ data: Array<{ entity_id: string }> }>("/me/watchlist");
  const watching = justWatched || Boolean(watchlist?.data.some((w) => w.entity_id === id));
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "overview") as Tab;
  const setTab = (t: Tab) => router.replace(`${pathname}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });
  const retry = () => mutate(`/subscribers/${id}`);
  const checkFor = tab === "transactions" ? CHECK.transactions : CHECK.activity;
  const addCheck = useAddCheckToCase(id, checkFor.section, checkFor.evidenceTitle);

  // Revealed details mask again when you leave the page.
  useEffect(() => () => hide(id), [id]);

  const openCases = sub?.cases.filter((c) => c.status !== "closed") ?? [];
  const openCase = openCases[0];
  // The lookup passes what it already knows, so loading and failure still say who this is.
  const name = sub?.name ?? params.get("name") ?? "Subscriber";
  const msisdn = sub ? localNumber(sub.msisdn) : params.get("msisdn") ? localNumber(params.get("msisdn")!) : id;

  const tabs = (
    <Tabs
      label="Subscriber"
      surface="canvas"
      value={tab}
      onChange={setTab}
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "activity", label: "Activity", count: sub?.counts.activity },
        { id: "transactions", label: "Transactions", count: sub?.counts.transactions },
        { id: "calls", label: "Calls" },
        { id: "sim", label: "SIM & devices", count: sub?.counts.devices },
        { id: "cases", label: "Cases", count: sub?.cases.length },
        { id: "audit", label: "Audit log" },
      ]}
    />
  );

  // C19/C26 · the Activity and Transactions tabs are the behaviour and patterns checks: export, then add to the case.
  const check = tab === "activity" ? CHECK.activity : tab === "transactions" ? CHECK.transactions : null;
  const actions = check ? (
    <>
      <Button variant="secondary" size="md" onClick={() => window.print()}>
        {check.exportLabel}
      </Button>
      {addCheck.openCase && (
        <Button size="md" onClick={addCheck.add} loading={addCheck.adding} disabled={!sub}>
          Add to case {addCheck.openCase.id}
        </Button>
      )}
    </>
  ) : (
    <>
      {/* G34 · Add to watchlist; already on your list reads “Watching”. */}
      <Button variant="secondary" size="md" disabled={!sub || watching} onClick={() => setWatchOpen(true)}>
        {watching ? "Watching" : "Watch"}
      </Button>
      {openCase && (
        <ButtonLink href={`/cases/${openCase.id}`} size="md">
          Go to {openCase.id}
        </ButtonLink>
      )}
    </>
  );

  const header = (meta: ReactNode) => (
    <div className="flex flex-col gap-5">
      <PageHead
        title={name}
        pill={sub?.wallet.status === "frozen" ? <Badge label="Wallet frozen" tone="neutral" size="md" /> : undefined}
        subtitle={meta}
        actions={actions}
      />
      {tabs}
    </div>
  );

  /* C18 · couldn’t load */
  if (error && !sub) {
    const problem = error instanceof ApiError ? error.problem : null;
    return (
      <>
        <AppHeader title={msisdn} />
        <PageBody>
          {header(msisdn)}
          <Card title="Overview">
            <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
              <span className="mb-3 flex size-8 items-center justify-center rounded-lg border border-border-default bg-surface-raised">
                <Icon name="app/icon-alert-circle-tertiary-20" size={16} />
              </span>
              <p className="text-label-m text-text-primary">{problem?.title ?? "Couldn’t load this subscriber"}</p>
              <p className="max-w-[420px] text-body-s text-text-secondary">
                {problem?.detail ?? "The subscriber service didn’t respond. Open cases and their evidence are safe."}
              </p>
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={retry} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
                  Retry
                </Button>
              </div>
              {problem?.request_id && <p className="mt-3 text-caption text-text-tertiary">Error ref {problem.request_id} · share with IT if it keeps happening</p>}
            </div>
          </Card>
        </PageBody>
      </>
    );
  }

  /* C17 · loading */
  if (!sub) {
    return (
      <>
        <AppHeader title={msisdn} />
        <PageBody>
          {header(`${msisdn} · loading profile`)}
          <div className="flex flex-col gap-4" aria-busy>
            <div className="flex gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <StatTileSkeleton key={i} />
              ))}
            </div>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex gap-6">
                <CardSkeleton className="min-w-0 flex-1" />
                <CardSkeleton className="w-[400px] shrink-0" />
              </div>
            ))}
          </div>
        </PageBody>
      </>
    );
  }

  const meta = [
    revealed?.values.msisdn ? localNumber(revealed.values.msisdn) : msisdn,
    `${PLAN[sub.plan] ?? sub.plan} since ${monthYear(sub.customer_since)}`,
    sub.home,
    openCases.length ? `${openCases.length} open ${openCases.length === 1 ? "case" : "cases"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <AppHeader title={msisdn} />
      <PageBody>
        {header(meta)}
        <div className="flex flex-col gap-4">
          {/* C15 · personal details revealed */}
          {revealed && (
            <Banner
              tone="info"
              title={`Personal details shown until ${formatClock(revealed.expires_at)}`}
              action={
                <Button variant="ghost" size="sm" onClick={() => hide(id)}>
                  Hide now
                </Button>
              }
            >
              You revealed them to {revealPurpose(revealed.reason)}. Logged and visible to your supervisor.
            </Banner>
          )}
          {/* C16 · partial data */}
          {sub.unavailable.map((source) => (
            <Banner
              key={source}
              tone="warning"
              title={SOURCE[source]?.title ?? `${source.replace(/_/g, " ")} didn’t respond`}
              action={
                <Button variant="ghost" size="sm" onClick={retry}>
                  Retry
                </Button>
              }
            >
              {SOURCE[source]?.detail ?? "Some details may be out of date. Everything else is live."}
            </Banner>
          ))}
          {tab === "overview" && (
            <>
              <SubscriberTiles sub={sub} now={now} />
              <div className="flex items-start gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                  <WhyHighRisk sub={sub} />
                  <OutflowChart id={id} />
                  <RecentActivity id={id} now={now} total={sub.counts.activity} onViewAll={() => setTab("activity")} />
                </div>
                <div className="flex w-[400px] shrink-0 flex-col gap-6">
                  <IdentityCard sub={sub} revealed={revealed} now={now} onReveal={() => setRevealOpen(true)} onHide={() => hide(id)} />
                  <SimDeviceCard sub={sub} now={now} />
                  <MobileMoneyCard sub={sub} />
                </div>
              </div>
            </>
          )}
          {/* C19/C20 · behaviour profile, C26 · transaction patterns, G35–G38 · number trace. */}
          {tab === "activity" && <BehaviourView id={id} />}
          {tab === "transactions" && <PatternsView id={id} />}
          {tab === "calls" && <CallsTab subscriberId={id} caseId={openCase?.id} />}
          {tab === "sim" && (
            <>
              <SubscriberTiles sub={sub} now={now} />
              {sub.device_warning && (
                <Banner tone="warning" title={sub.device_warning.title}>
                  {sub.device_warning.detail}
                </Banner>
              )}
              <SimDevicesTab sub={sub} now={now} />
              {/* C21–C25 · the SIM and device checks. */}
              <Card title="Checks">
                <div className="flex flex-col">
                  <GuideRow
                    href={`/subscribers/${id}/sim-check`}
                    icon="app/icon-sim-secondary-16"
                    title="SIM duplication check"
                    detail="Is this SIM live in two phones at once? Checked against network registrations"
                  />
                  <GuideRow
                    href={`/subscribers/${id}/device-check`}
                    icon="app/icon-laptop-secondary-18"
                    title="Device check"
                    detail="IMEI check digit, model and the stolen-phone list"
                  />
                </div>
              </Card>
            </>
          )}
          {tab === "cases" && (
            <Card title="Case history" aside={<CardMeta>{sub.cases.length} {sub.cases.length === 1 ? "case" : "cases"}</CardMeta>}>
              <CaseHistoryRows cases={sub.cases} now={now} />
            </Card>
          )}
          {tab === "audit" && <AuditTab id={id} now={now} />}
        </div>
      </PageBody>
      {revealOpen && (
        <RevealModal
          open
          onClose={() => setRevealOpen(false)}
          subscriber={{ id, name: sub.name, msisdn }}
          cases={openCases.map((c) => ({ id: c.id, title: c.title }))}
        />
      )}
      {watchOpen && sub && (
        <WatchModal
          title={`Watch ${msisdn}`}
          subtitle={openCase ? `${sub.name} · ${openCase.id}` : sub.name}
          entityIds={[id]}
          caseId={openCase?.id}
          onWatched={() => setJustWatched(true)}
          onClose={() => setWatchOpen(false)}
        />
      )}
    </>
  );
}
