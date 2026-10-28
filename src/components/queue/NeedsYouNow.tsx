"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { SeverityBadge, riskTone } from "@/components/app/indicators";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { fraudTypeLabel, type CaseSummary } from "@/lib/api/fd";
import { formatSpan } from "@/lib/time";

const SOON_MS = 30 * 60_000;

/** Cases that need action now — breached, due within 30 min, sent back or not yet opened. Breached first, then time left. */
export function needsYou(cases: CaseSummary[], now: number) {
  return cases
    .filter((c) => c.status === "sent_back" || c.status === "new" || Date.parse(c.sla_due_at) - now < SOON_MS)
    .sort((a, b) => Date.parse(a.sla_due_at) - Date.parse(b.sla_due_at) || b.risk_score - a.risk_score)
    .slice(0, 4);
}

/** Reason line icons are neutral; the glyph says why. */
function ReasonIcon({ name }: { name: string }) {
  return (
    <span className="icon-tint flex shrink-0 text-text-tertiary">
      <Icon name={name} size={14} />
    </span>
  );
}

/** The reason it needs you, the pill and the verb, from the case’s status and SLA. */
function describe(c: CaseSummary, now: number): { icon: string; reason: string; action: string; breached: boolean } {
  const left = Date.parse(c.sla_due_at) - now;
  if (left < 0) {
    return { icon: "app/icon-alert-circle-tertiary-14", reason: `SLA breached ${formatSpan(left)} ago`, action: "Open now", breached: true };
  }
  const minutes = `${Math.max(1, Math.round(left / 60_000))} min left`;
  if (c.status === "sent_back") {
    const by = c.reviewer?.name.split(" ")[0];
    return { icon: "app/icon-refresh-high-14", reason: by ? `Sent back by ${by}` : "Sent back · changes requested", action: "Fix", breached: false };
  }
  if (c.status === "new") return { icon: "app/icon-timer-tertiary-14", reason: `New · ${minutes}`, action: "Start", breached: false };
  return { icon: "app/icon-timer-tertiary-14", reason: minutes, action: "Continue", breached: false };
}

/** Needs you now row (1319:168931) — fixed 96 badge column and 112 action column; only the first row is primary. */
function NeedsRow({ c, now, primary }: { c: CaseSummary; now: number; primary: boolean }) {
  const d = describe(c, now);
  return (
    <li className="flex h-16 items-center gap-4 border-b border-border-default py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-mono-m text-text-primary">{c.id}</span>
          <span className="truncate text-body-s text-text-secondary">{fraudTypeLabel(c.fraud_type)}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5">
          <ReasonIcon name={d.icon} />
          <span className="truncate text-caption text-text-secondary">{d.reason}</span>
        </p>
      </div>
      <span className="flex w-24 shrink-0 justify-end">
        {d.breached ? <Badge label="Breached" tone="critical" /> : <SeverityBadge severity={riskTone(c.risk_score)} />}
      </span>
      <ButtonLink href={`/cases/${c.id}`} size="md" variant={primary ? "primary" : "secondary"} className="w-28">
        {d.action}
      </ButtonLink>
    </li>
  );
}

/** A1 · My queue · Needs you now. */
export function NeedsYouNow({ cases, now }: { cases: CaseSummary[]; now: number }) {
  const items = needsYou(cases, now);
  return (
    <Card title="Needs you now" aside={<CardMeta>Breached first, then time left</CardMeta>}>
      {items.length === 0 ? (
        <p className="pb-1 text-body-s text-text-secondary">Nothing is due in the next 30 minutes.</p>
      ) : (
        <ul className="-mb-2 flex flex-col">
          {items.map((c, i) => (
            <NeedsRow key={c.id} c={c} now={now} primary={i === 0} />
          ))}
        </ul>
      )}
    </Card>
  );
}
