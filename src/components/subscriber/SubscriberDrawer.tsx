"use client";

import { Tabs } from "@/components/app/Card";
import { CaseStatusBadge } from "@/components/app/indicators";
import { ActivityTab, KycTab } from "@/components/alerts/AlertTabs";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useCopy } from "@/components/ui/CopyButton";
import { Drawer, KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { useSubscriber, type Subscriber } from "@/lib/api/fd";
import { useRevealed } from "@/lib/api/reveal";
import { formatDate, formatMoney, formatWhen } from "@/lib/time";
import Link from "next/link";
import { useState, type ReactNode } from "react";

type Tab = "overview" | "wallet" | "sim" | "cases" | "contact";

function Section({ icon, title, children, aside }: { icon: string; title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border-subtle px-[18px] py-4">
      <h3 className="flex items-center gap-2 text-title text-text-primary">
        <Icon name={icon} size={18} />
        {title}
        {aside}
      </h3>
      {children}
    </section>
  );
}

const yearsSince = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / (365.25 * 86_400_000));

export function CaseHistory({ cases }: { cases: Subscriber["cases"] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      <table className="w-full text-left">
        <thead className="border-b border-border-subtle bg-surface-raised">
          <tr className="text-overline text-text-tertiary uppercase">
            <th className="py-2.5 pl-4 font-bold">Case</th>
            <th className="py-2.5 font-bold">What</th>
            <th className="py-2.5 pr-4 font-bold">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="border-b border-border-subtle last:border-b-0">
              <td className="py-2.5 pl-4">
                <Link href={`/cases/${c.id}`} className="font-mono text-mono-m text-text-primary hover:underline">
                  {c.id}
                </Link>
              </td>
              <td className="py-2.5 text-body-s text-text-secondary">
                {c.title} · {formatDate(c.waiting_since).replace(/^\d+ /, "")}
              </td>
              <td className="py-2.5 pr-4">
                {c.status === "closed" ? <Badge label="False positive" tone="success" /> : <CaseStatusBadge status={c.status} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const [tab, setTab] = useState<Tab>("overview");
  const { copy, copied } = useCopy(sub?.msisdn ?? "");
  if (!sub) return null;

  const past = sub.cases.filter((c) => c.status === "closed");
  const openCase = sub.cases.find((c) => c.status !== "closed");
  const usual = formatMoney(sub.wallet.usual_monthly_out.amount_minor, sub.wallet.usual_monthly_out.currency);
  const swappedToday = sub.sim.last_swap_at && now - Date.parse(sub.sim.last_swap_at) < 86_400_000;

  return (
    <Drawer
      open
      onClose={onClose}
      width={640}
      badges={
        <>
          {sub.kyc.nia_verified && <Badge label="Ghana Card verified" tone="success" />}
          <Badge label={sub.wallet.status === "frozen" ? "Wallet frozen" : "Wallet active"} tone={sub.wallet.status === "frozen" ? "critical" : "neutral"} dot />
        </>
      }
      title={`${revealed?.values.name ?? sub.name} · ${revealed?.values.msisdn ?? sub.msisdn}`}
      subtitle={`Prepaid · Tier ${sub.wallet.tier} MoMo wallet · ${sub.contact.language.includes("Twi") ? "Kumasi, Ashanti" : "Ghana"}`}
      headerActions={
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy number"}
          className="flex size-10 items-center justify-center rounded-[10px] border border-border-default bg-surface-base hover:bg-surface-raised"
        >
          <Icon name="app/icon-copy-primary-20" size={20} />
        </button>
      }
      tabs={
        <Tabs
          label="Subscriber"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "wallet", label: "Wallet", count: 9 },
            { id: "sim", label: "SIM & devices", count: 4 },
            { id: "cases", label: "Cases", count: sub.cases.length },
            { id: "contact", label: "Contact" },
          ]}
        />
      }
      footer={
        <>
          <span className="flex-1" />
          <ButtonLink href={`/subscribers/${sub.id}`} variant="secondary" size="md" iconLeft={<Icon name="app/icon-external-18" size={18} />}>
            Open full profile page
          </ButtonLink>
        </>
      }
    >
      {tab === "overview" && (
        <>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border-subtle px-4 py-3">
              <span className="text-label-s text-text-secondary">Customer since</span>
              <span className="text-h1 text-text-primary">{new Date(sub.customer_since).getFullYear()}</span>
              <span className="text-caption text-text-secondary">{yearsSince(sub.customer_since, now)} years on Kasa Mobile</span>
            </div>
            <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border-subtle px-4 py-3">
              <span className="text-label-s text-text-secondary">Usual MoMo / month</span>
              <span className="text-h1 text-text-primary">{usual}</span>
              {openCase && openCase.money_at_stake.amount_minor > 0 && (
                <span className="text-caption text-critical-fg">
                  Today: {formatMoney(openCase.money_at_stake.amount_minor, openCase.money_at_stake.currency)}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border-subtle px-4 py-3">
              <span className="text-label-s text-text-secondary">Past cases</span>
              <span className="text-h1 text-text-primary">{past.length}</span>
              <span className="text-caption text-text-secondary">
                {past[0] ? `Closed ${new Date(past[0].waiting_since).getFullYear()} · false positive` : "None"}
              </span>
            </div>
          </div>
          <Section icon="app/icon-user-secondary-16" title="Identity">
            <KeyValueList
              rows={[
                ["Name", revealed?.values.name ?? `${sub.name} (masked)`],
                ["Ghana Card", `${revealed?.values.ghana_card ?? sub.kyc.ghana_card} · verified ${formatDate(sub.kyc.verified_at).replace(/^\d+ /, "")}`],
                ["Address", sub.kyc.address ?? "Bantama, Kumasi"],
              ]}
            />
          </Section>
          <Section icon="app/icon-phone-secondary-18" title="Reach the subscriber">
            <KeyValueList
              rows={[
                ["Registered number", <span key="r" className={swappedToday ? "text-critical-fg" : undefined}>{sub.msisdn}{swappedToday ? " · compromised" : ""}</span>],
                ["Alternate number", `${revealed?.values.alt_msisdn ?? sub.contact.alt_msisdn} · verified 2023`],
                ["Preferred language", sub.contact.language],
                ["Last called by us", sub.contact.last_called_at ? formatWhen(sub.contact.last_called_at, now) : "Not called yet"],
              ]}
            />
            {onLogCall && (
              <Button variant="secondary" size="sm" fullWidth onClick={onLogCall} iconLeft={<Icon name="app/icon-phone-16" size={16} />}>
                Log a call
              </Button>
            )}
          </Section>
          <Section icon="app/icon-folder-secondary-16" title="Case history" aside={<Badge label={String(sub.cases.length)} tone="neutral" />}>
            <CaseHistory cases={sub.cases} />
          </Section>
        </>
      )}
      {tab === "wallet" && (
        <Section icon="app/icon-wallet-18" title="Mobile money">
          <KeyValueList
            rows={[
              ["Wallet", `Tier ${sub.wallet.tier} · limit ${formatMoney(sub.wallet.daily_limit.amount_minor, sub.wallet.daily_limit.currency)}/day`],
              ["Status", <span key="s" className={sub.wallet.status === "frozen" ? "text-critical-fg" : undefined}>{sub.wallet.status === "frozen" ? "Frozen" : "Active"}</span>],
              ["Balance", formatMoney(sub.wallet.balance.amount_minor, sub.wallet.balance.currency, { decimals: true })],
              ["Usual month out", usual],
            ]}
          />
        </Section>
      )}
      {tab === "sim" && <KycTab subscriberId={subscriberId} now={now} />}
      {tab === "cases" && <CaseHistory cases={sub.cases} />}
      {tab === "contact" && <ActivityTab subscriberId={subscriberId} now={now} />}
    </Drawer>
  );
}

