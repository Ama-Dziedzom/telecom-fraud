"use client";

import { Card, CardMeta, Tabs } from "@/components/app/Card";
import { ActivityTab, KycTab } from "@/components/alerts/AlertTabs";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { useSubscriber } from "@/lib/api/fd";
import { useRevealed } from "@/lib/api/reveal";
import { useOperatorName } from "@/lib/auth/session";
import { formatWhen } from "@/lib/time";
import { useState } from "react";
import { CaseHistoryRows, DetailRows, localNumber, money, monthYear, StatTile } from "./ProfileParts";

type Tab = "overview" | "wallet" | "sim" | "cases" | "contact";

const yearsSince = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / (365.25 * 86_400_000));

/** C11 · Subscriber 360 in a drawer, from the case header. */
export function SubscriberDrawer({
  subscriberId,
  now,
  onClose,
  onLogCall,
}: {
  subscriberId: string;
  now: number;
  onClose: () => void;
  onLogCall?: () => void;
}) {
  const { data: sub } = useSubscriber(subscriberId);
  const revealed = useRevealed(subscriberId);
  const operator = useOperatorName();
  const [tab, setTab] = useState<Tab>("overview");
  if (!sub) return null;

  const past = sub.cases.filter((c) => c.status === "closed");
  const openCase = sub.cases.find((c) => c.status !== "closed");
  const swappedToday = !!sub.sim.last_swap_at && formatWhen(sub.sim.last_swap_at, now, { withTime: true }).startsWith("Today");
  const frozen = sub.wallet.status === "frozen";
  const msisdn = localNumber(revealed?.values.msisdn ?? sub.msisdn);

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      badges={
        <>
          {sub.kyc.nia_verified && <Badge label="Ghana Card verified" tone="success" size="md" />}
          <Badge label={frozen ? "Wallet frozen" : "Wallet active"} tone="neutral" size="md" />
        </>
      }
      title={`${revealed?.values.name ?? sub.name} · ${msisdn}`}
      subtitle={`${sub.plan === "postpaid" ? "Postpaid" : "Prepaid"} · Tier ${sub.wallet.tier} MoMo wallet · ${sub.home}`}
      tabs={
        <Tabs
          label="Subscriber"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "wallet", label: "Wallet", count: sub.counts.transactions },
            { id: "sim", label: "SIM & devices", count: sub.counts.devices },
            { id: "cases", label: "Cases", count: sub.cases.length },
            { id: "contact", label: "Contact" },
          ]}
        />
      }
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
          <span className="flex-1" />
          <ButtonLink href={`/subscribers/${sub.id}`} size="md">
            Open full profile
          </ButtonLink>
        </>
      }
    >
      {tab === "overview" && (
        <>
          <div className="flex gap-3">
            <StatTile
              label="Customer since"
              value={new Date(sub.customer_since).getFullYear()}
              sub={`${yearsSince(sub.customer_since, now)} years on ${operator ?? "the network"}`}
            />
            <StatTile
              label="Usual MoMo a month"
              value={money(sub.wallet.usual_monthly_out)}
              sub={openCase && openCase.money_at_stake.amount_minor > 0 ? `Today: ${money(openCase.money_at_stake)}` : undefined}
            />
            <StatTile
              label="Past cases"
              value={past.length}
              sub={past[0] ? `${new Date(past[0].waiting_since).getFullYear()} · false positive` : "None"}
            />
          </div>
          <Card title="Identity">
            <DetailRows
              rows={[
                ["Name", revealed?.values.name ?? `${sub.name} (masked)`],
                ["Ghana Card", `${revealed?.values.ghana_card ?? sub.kyc.ghana_card} · verified ${monthYear(sub.kyc.verified_at)}`],
                ["Address", revealed?.values.address ?? sub.kyc.address],
              ]}
            />
          </Card>
          <Card title="Reach the subscriber">
            <div className="flex flex-col gap-2">
              <DetailRows
                rows={[
                  ["Registered number", `${msisdn}${swappedToday ? " · compromised" : ""}`],
                  // TODO(api): 0.2 doesn’t say when the alternate number was verified.
                  ["Alternate number", revealed?.values.alt_msisdn ? localNumber(revealed.values.alt_msisdn) : sub.contact.alt_msisdn],
                  ["Language", sub.contact.language],
                  ["Last called", sub.contact.last_called_at ? formatWhen(sub.contact.last_called_at, now, { withTime: true }) : "Not called yet"],
                ]}
              />
              {onLogCall && (
                <Button variant="secondary" size="md" fullWidth onClick={onLogCall}>
                  Log a call
                </Button>
              )}
            </div>
          </Card>
          <Card title="Case history" aside={<CardMeta>{sub.cases.length} {sub.cases.length === 1 ? "case" : "cases"}</CardMeta>}>
            <CaseHistoryRows cases={sub.cases} now={now} />
          </Card>
        </>
      )}
      {tab === "wallet" && (
        <Card title="Mobile money">
          <DetailRows
            rows={[
              ["Wallet", `Tier ${sub.wallet.tier} · limit ${money(sub.wallet.daily_limit)} a day`],
              ["Status", frozen ? "Frozen" : "Active"],
              ["Balance", sub.unavailable.includes("wallet") ? "Not available" : money(sub.wallet.balance, true)],
              ["Usual month out", money(sub.wallet.usual_monthly_out)],
            ]}
          />
        </Card>
      )}
      {tab === "sim" && <KycTab subscriberId={subscriberId} now={now} />}
      {tab === "cases" && (
        <Card title="Case history" aside={<CardMeta>{sub.cases.length} {sub.cases.length === 1 ? "case" : "cases"}</CardMeta>}>
          <CaseHistoryRows cases={sub.cases} now={now} />
        </Card>
      )}
      {tab === "contact" && <ActivityTab subscriberId={subscriberId} now={now} />}
    </Drawer>
  );
}
