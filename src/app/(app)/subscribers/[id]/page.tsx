"use client";

import { ActivityTab } from "@/components/alerts/AlertTabs";
import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Card, Skeleton, Tabs } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { TransactionsTab } from "@/components/case/TransactionsTab";
import {
  IdentityCard,
  MobileMoneyCard,
  OutflowChart,
  RecentActivity,
  SimDeviceCard,
  SummaryStrip,
  WhyHighRisk,
} from "@/components/subscriber/ProfileParts";
import { RevealModal } from "@/components/subscriber/RevealModal";
import { CaseHistory } from "@/components/subscriber/SubscriberDrawer";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { ApiError } from "@/lib/api/client";
import { hide, useRevealed } from "@/lib/api/reveal";
import { useAudit, useSubscriber360, type Subscriber360 } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatClock, formatDate, formatSpan, formatWhen, useNow } from "@/lib/time";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";

type Tab = "overview" | "activity" | "transactions" | "sim" | "cases" | "audit";
const TABS: Tab[] = ["overview", "activity", "transactions", "sim", "cases", "audit"];

function SimDevicesTab({ sub, now }: { sub: Subscriber360; now: number }) {
  return (
    <>
      {sub.device_warning && (
        <Banner tone="warning" title={sub.device_warning.title}>
          {sub.device_warning.detail}
        </Banner>
      )}
      <Card title={<span className="flex items-center gap-2">SIM history <Badge label={String(sub.sim_history?.length ?? 0)} tone="neutral" /></span>} icon="app/icon-sim-18">
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          <table className="w-full text-left">
            <thead className="border-b border-border-subtle bg-surface-raised">
              <tr className="text-overline text-text-tertiary uppercase">
                {["When", "ICCID", "Event", "Where / agent", "ID check"].map((h) => (
                  <th key={h} className="py-[11px] pl-4 font-bold first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sub.sim_history?.map((h) => (
                <tr key={h.at} className="relative border-b border-border-subtle last:border-b-0">
                  <td className="relative py-3 pl-5 font-mono text-mono-s text-text-primary">
                    {h.event === "sim_swap" && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-critical-fg" />}
                    {formatWhen(h.at, now, { withTime: true }).replace(/^(\d+ \w+)$/, (d) => `${d} ${new Date(h.at).getFullYear()}`)}
                  </td>
                  <td className="py-3 pl-4 font-mono text-mono-s text-text-secondary">{h.iccid}</td>
                  <td className="py-3 pl-4">{h.event === "sim_swap" ? <Badge label="SIM swap" tone="critical" dot /> : <span className="text-body-s text-text-primary">New SIM · registration</span>}</td>
                  <td className={cn("py-3 pl-4 text-body-s", h.agent ? "text-text-brand" : "text-text-primary")}>{h.where}</td>
                  <td className={cn("py-3 pl-4 text-body-s", h.id_ok ? "text-text-secondary" : "text-critical-fg")}>{h.id_check}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2">Devices on this wallet <Badge label={String(sub.devices_on_wallet?.length ?? 0)} tone="neutral" /></span>} icon="app/icon-phone-secondary-18">
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          <table className="w-full text-left">
            <thead className="border-b border-border-subtle bg-surface-raised">
              <tr className="text-overline text-text-tertiary uppercase">
                {["Device", "IMEI", "First seen", "Last seen", "Shared with", ""].map((h, i) => (
                  <th key={i} className="py-[11px] pl-4 font-bold first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sub.devices_on_wallet?.map((d) => (
                <tr key={d.imei} className="border-b border-border-subtle last:border-b-0">
                  <td className="relative py-3 pl-5">
                    {d.risky && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-critical-fg" />}
                    <span className="flex items-center gap-2 text-body-m text-text-primary">
                      <Icon name={d.risky ? "app/icon-phone-high-18" : "app/icon-phone-18"} size={16} />
                      {d.model}
                    </span>
                  </td>
                  <td className="py-3 pl-4 font-mono text-mono-s text-text-secondary">{d.imei}</td>
                  <td className={cn("py-3 pl-4 text-body-s", d.risky ? "text-critical-fg" : "text-text-secondary")}>
                    {d.risky ? `Today ${formatClock(d.first_seen)}` : formatDate(d.first_seen).replace(/^\d+ /, "")}
                  </td>
                  <td className="py-3 pl-4 text-body-s text-text-secondary">
                    {d.last_seen === "now" ? "Now" : formatDate(d.last_seen).replace(/^\d+ /, "")}
                  </td>
                  <td className={cn("py-3 pl-4 text-body-s", d.risky ? "text-critical-fg" : "text-text-secondary")}>{d.shared_with}</td>
                  <td className="py-3 pr-5 text-right">
                    {d.risky && (
                      <ButtonLink href={`/network?seed=${sub.id}`} variant="ghost" size="sm" iconLeft={<Icon name="app/icon-network-brand-16" size={16} />}>
                        Open in network
                      </ButtonLink>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function AuditTab({ id, now }: { id: string; now: number }) {
  const { data } = useAudit(id);
  const LABEL: Record<string, string> = {
    "pii.revealed": "Revealed personal details",
    "wallet.frozen": "Froze the wallet",
    "profile.viewed": "Opened this profile",
  };
  return (
    <Card title="Audit log" icon="app/icon-shield-tertiary-16" aside={<span className="text-caption text-text-tertiary">Every view and change is logged</span>}>
      <ul className="flex flex-col">
        {data?.data.map((e) => (
          <li key={e.id} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
            <Avatar initials={e.actor.initials} />
            <span className="flex-1 text-body-s text-text-primary">
              {e.actor.name} · {LABEL[e.action] ?? e.action}
              {e.reason ? <span className="text-text-secondary"> · {e.reason}</span> : null}
            </span>
            <span className="font-mono text-mono-s text-text-tertiary">{formatWhen(e.at, now)}</span>
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
  const { data: sub, error, isLoading } = useSubscriber360(id);
  const revealed = useRevealed(id);
  const [revealOpen, setRevealOpen] = useState(false);
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "overview") as Tab;
  const setTab = (t: Tab) => router.replace(`${pathname}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });

  // Revealed details mask again when you leave the page.
  useEffect(() => () => hide(id), [id]);

  const openCase = sub?.cases.find((c) => c.status !== "closed");
  // The lookup passes what it already knows, so a failed load still says who this is.
  const hintName = params.get("name");
  const hintMsisdn = params.get("msisdn");
  const title = sub ? (revealed?.values.msisdn ?? sub.msisdn) : (hintMsisdn ?? id);
  const initials =
    sub?.initials ?? (sub?.name ?? hintName ?? "")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const header = (disabled: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Avatar initials={initials} size={40} className="size-14 text-h3" />
        <div className="flex flex-col gap-1">
          <h2 className={cn("flex items-center gap-3 text-h1", revealed ? "text-medium-fg" : "text-text-primary")}>
            {revealed?.values.name ?? sub?.name ?? hintName ?? "Subscriber"}
            {sub && <Badge label={sub.status === "active" ? "Active" : sub.status} tone="success" dot />}
            {openCase && <Badge label="1 open case" tone="critical" dot />}
          </h2>
          <p className="flex items-center gap-2 text-body-s text-text-secondary">
            <span className={cn("font-mono text-mono-m", revealed ? "text-medium-fg" : "text-text-primary")}>{title}</span>
            {sub && (
              <button
                type="button"
                onClick={() => (revealed ? hide(id) : setRevealOpen(true))}
                aria-label={revealed ? "Hide personal details" : "Reveal personal details"}
                className="flex rounded"
              >
                <Icon name="app/icon-eye-brand-16" size={16} />
              </button>
            )}
            {sub && (
              <>
                <span className="text-text-tertiary">·</span>
                {sub.plan ?? "Prepaid"} since {formatDate(sub.prepaid_since ?? sub.customer_since).replace(/^\d+ /, "")} · {sub.home}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <ButtonLink href={`/watchlist/new?subscriber=${id}`} variant="secondary" size="md" aria-disabled={disabled} className={disabled ? "pointer-events-none opacity-50" : undefined} iconLeft={<Icon name="app/icon-eye-primary-18" size={18} />}>
          Watch
        </ButtonLink>
        <Menu
          label="Protect"
          trigger={(t) => (
            <Button
              variant="secondary"
              size="md"
              disabled={disabled}
              onClick={t.toggle}
              aria-expanded={t["aria-expanded"]}
              iconLeft={<Icon name="app/icon-shield-primary-18" size={18} />}
              iconRight={<Icon name="app/icon-chevron-down-primary-18" size={18} />}
            >
              Protect
            </Button>
          )}
        >
          {(close) =>
            openCase ? (
              <MenuItem
                icon="app/icon-shield-critical-18"
                title={`Protect from ${openCase.id}`}
                description="Protective actions are recorded on the case."
                onSelect={() => {
                  close();
                  router.push(`/cases/${openCase.id}?protect=1`);
                }}
              />
            ) : (
              <MenuItem icon="app/icon-shield-critical-18" title="Open a case first" description="Protective actions are always recorded on a case." onSelect={close} disabled />
            )
          }
        </Menu>
        {openCase && (
          <ButtonLink href={`/cases/${openCase.id}`} size="md" className={disabled ? "pointer-events-none opacity-50" : undefined} iconRight={<Icon name="app/icon-arrow-right-white-18" size={18} />}>
            Go to {openCase.id}
          </ButtonLink>
        )}
      </div>
    </div>
  );

  if (error) {
    const problem = error instanceof ApiError ? error.problem : null;
    return (
      <>
        <AppHeader section="Subscriber lookup" title={id} />
        <PageBody>
          {header(true)}
          <EmptyState
            icon="app/icon-alert-triangle-critical-26"
            tone="critical"
            title={problem?.title ?? "Couldn’t load this subscriber"}
            className="py-12"
            actions={
              <>
                <Button size="md" onClick={() => mutate(`/subscribers/${id}`)} iconLeft={<Icon name="app/icon-refresh-white-18" size={18} />}>
                  Try again
                </Button>
                <ButtonLink href="/lookup" variant="secondary" size="md" iconLeft={<Icon name="app/icon-arrow-left-18" size={18} />}>
                  Back to lookup
                </ButtonLink>
              </>
            }
            meta={problem?.request_id ? <p className="font-mono text-mono-s text-text-tertiary">Error ref {problem.request_id} · share with IT if it keeps happening</p> : null}
          >
            {problem?.detail ?? "Something went wrong loading this number. Try again in a moment."}
          </EmptyState>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <AppHeader section="Subscriber lookup" title={title} />
      <PageBody>
        {revealed && (
          <div className="flex items-center gap-3 rounded-[10px] bg-medium-bg px-4 py-2.5" role="status">
            <Icon name="app/icon-eye-medium-18" size={18} />
            <p className="flex-1 text-body-s text-medium-fg">
              Personal details visible · {formatSpan(Date.parse(revealed.expires_at) - now)} left · reason:{" "}
              {revealed.case_id ? `investigating ${revealed.case_id}` : revealed.reason.replace(/_/g, " ")} · logged
            </p>
            <Button variant="secondary" size="sm" onClick={() => hide(id)} iconLeft={<Icon name="app/icon-eye-off-16" size={16} />}>
              Hide now
            </Button>
          </div>
        )}
        {header(isLoading || !sub)}
        {!sub ? (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-[74px] w-full rounded-xl" />
            <Skeleton className="h-10 w-[520px]" />
            <div className="flex gap-4">
              <Skeleton className="h-[480px] flex-1 rounded-xl" />
              <Skeleton className="h-[480px] w-[400px] rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {sub.unavailable?.length ? (
              <Banner tone="warning" title="Some data is unavailable">
                Mobile money didn’t respond. Wallet figures in the summary are from {sub.wallet_as_of ? formatClock(sub.wallet_as_of) : "earlier"} and may be out of date.
              </Banner>
            ) : null}
            <SummaryStrip sub={sub} now={now} />
            <Tabs
              label="Subscriber"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "overview", label: "Overview" },
                { id: "activity", label: "Activity", count: sub.counts?.activity },
                { id: "transactions", label: "Transactions", count: sub.counts?.transactions },
                { id: "sim", label: "SIM & devices", count: sub.counts?.devices },
                { id: "cases", label: "Cases", count: sub.cases.length },
                { id: "audit", label: "Audit log" },
              ]}
            />
            {tab === "overview" && (
              <div className="flex items-start gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <WhyHighRisk sub={sub} />
                  <OutflowChart id={id} />
                  <RecentActivity id={id} now={now} total={sub.counts?.activity} onViewAll={() => setTab("activity")} />
                </div>
                <div className="flex w-[400px] shrink-0 flex-col gap-4">
                  <IdentityCard sub={sub} revealed={revealed} onReveal={() => setRevealOpen(true)} onHide={() => hide(id)} />
                  <SimDeviceCard sub={sub} now={now} />
                  <MobileMoneyCard sub={sub} onRetry={() => mutate(`/subscribers/${id}`)} />
                </div>
              </div>
            )}
            {tab === "activity" && (
              <Card>
                <ActivityTab subscriberId={id} now={now} />
              </Card>
            )}
            {tab === "transactions" && <TransactionsTab subscriberId={id} now={now} />}
            {tab === "sim" && <SimDevicesTab sub={sub} now={now} />}
            {tab === "cases" && <CaseHistory cases={sub.cases} />}
            {tab === "audit" && <AuditTab id={id} now={now} />}
          </>
        )}
      </PageBody>
      {sub && revealOpen && (
        <RevealModal
          open
          onClose={() => setRevealOpen(false)}
          subscriber={{ id, name: sub.name }}
          cases={sub.cases.filter((c) => c.status !== "closed").map((c) => ({ id: c.id, title: c.title }))}
        />
      )}
    </>
  );
}
