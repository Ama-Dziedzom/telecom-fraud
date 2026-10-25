"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useCopy } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { SeverityBadge } from "@/components/app/indicators";
import { STAGES, type CaseDetail } from "@/lib/api/cases";
import { fraudTypeLabel, useMyCases } from "@/lib/api/fd";
import { useRevealed } from "@/lib/api/reveal";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";
import type { ReactNode } from "react";

const OUTCOME = {
  confirmed_fraud: { label: "Confirmed fraud", tone: "critical" as const },
  false_positive: { label: "False positive", tone: "success" as const },
  inconclusive: { label: "Inconclusive", tone: "neutral" as const },
};

/** Alert ✓ — Investigate ◉ — Act ○ — Decide ○ — Closed ○ — Monitor ○ */
export function StageBar({ stage, status }: { stage: CaseDetail["stage"]; status: CaseDetail["status"] }) {
  const current =
    stage === "monitor"
      ? STAGES.findIndex((s) => s.id === "monitor")
      : status === "closed"
        ? STAGES.findIndex((s) => s.id === "closed")
        : status === "pending_decision" || status === "sent_back"
          ? STAGES.findIndex((s) => s.id === "decide")
          : Math.max(1, STAGES.findIndex((s) => s.id === stage));
  return (
    <ol aria-label="Case stage" className="flex items-center gap-2 py-1">
      {STAGES.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s.id} className="flex items-center gap-2" aria-current={now ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={cn("h-0.5 w-5 rounded-[1px]", i <= current ? "bg-brand-primary" : "bg-border-default")} />}
            <span className="flex items-center gap-1.5">
              {done ? (
                <span className="flex size-4 items-center justify-center rounded-lg bg-brand-primary">
                  <Icon name="app/icon-check-white-10" size={10} />
                </span>
              ) : now ? (
                <Icon name="app/stage-current-16" size={16} />
              ) : (
                <span className="size-4 rounded-lg border-[1.5px] border-border-default bg-surface-base" />
              )}
              <span className={cn("text-body-s", now ? "font-medium text-text-brand" : done ? "text-text-secondary" : "text-text-tertiary")}>
                {s.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Copy link · Previous · Next case — moves through my open cases. */
export function CaseNav({ caseId }: { caseId: string }) {
  const { data } = useMyCases();
  const { copy, copied } = useCopy(typeof window === "undefined" ? "" : window.location.href.split("?")[0]);
  const ids = data?.data.map((c) => c.id) ?? [];
  const i = ids.indexOf(caseId);
  const prev = i > 0 ? ids[i - 1] : null;
  const next = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={copy} iconLeft={<Icon name="app/icon-link-brand-16" size={16} />}>
        {copied ? "Copied" : "Copy link"}
      </Button>
      {prev ? (
        <ButtonLink href={`/cases/${prev}`} variant="secondary" size="sm" iconLeft={<Icon name="app/icon-chevron-left-16" size={16} />}>
          Previous
        </ButtonLink>
      ) : (
        <Button variant="secondary" size="sm" disabled iconLeft={<Icon name="app/icon-chevron-left-16" size={16} />}>
          Previous
        </Button>
      )}
      {next ? (
        <ButtonLink href={`/cases/${next}`} variant="secondary" size="sm" iconRight={<Icon name="app/icon-chevron-right-16" size={16} />}>
          Next case
        </ButtonLink>
      ) : (
        <Button variant="secondary" size="sm" disabled iconRight={<Icon name="app/icon-chevron-right-16" size={16} />}>
          Next case
        </Button>
      )}
    </div>
  );
}

/** FD-3050 Critical — then “KM Kojo M. +233 … 👁 · Assigned to you · Opened 09:25 from AL-88213”. */
export function CaseTitle({
  detail,
  meId,
  onOpenSubscriber,
  onReveal,
  actions,
}: {
  detail: CaseDetail;
  meId?: string;
  onOpenSubscriber: () => void;
  onReveal: () => void;
  actions: ReactNode;
}) {
  const revealed = useRevealed(detail.subject.subscriber_id);
  const initials = detail.subject.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const assigned = !detail.assignee ? "In the team queue" : detail.assignee.id === meId ? "Assigned to you" : `Assigned to ${detail.assignee.name}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-3 text-h1 text-text-primary">
          {detail.id}
          <SeverityBadge severity={detail.severity} size="md" />
          {detail.status === "closed" &&
            (detail.resolution ? (
              <Badge label={OUTCOME[detail.resolution.outcome].label} tone={OUTCOME[detail.resolution.outcome].tone} size="md" />
            ) : (
              <Badge label="Closed" tone="neutral" size="md" dot />
            ))}
          {detail.status === "pending_decision" && <Badge label="Pending decision" tone="medium" size="md" dot />}
          {(detail.status === "pending_decision" || detail.status === "closed") && (
            <span className="flex items-center gap-1 rounded-full bg-neutral-bg px-2.5 py-1 text-label-s text-neutral-fg">
              <Icon name="icon-lock-secondary-16" size={14} />
              Read-only
            </span>
          )}
          {detail.status === "sent_back" && <Badge label="Sent back" tone="high" size="md" dot />}
          {detail.status === "escalated" && <Badge label="Escalated" tone="critical" size="md" dot />}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-body-s text-text-secondary">
          <Avatar initials={initials} />
          <button type="button" onClick={onOpenSubscriber} className="rounded text-label-s text-text-brand underline">
            {revealed?.values.name ?? detail.subject.name}
          </button>
          <span className="font-mono text-mono-s">{revealed?.values.msisdn ?? detail.subject.msisdn}</span>
          {!revealed && (
            <button type="button" onClick={onReveal} aria-label="Reveal personal details" className="flex rounded">
              <Icon name="app/icon-eye-secondary-16" size={16} />
            </button>
          )}
          <span className="text-text-tertiary">·</span>
          {assigned}
          <span className="text-text-tertiary">·</span>
          Opened {formatClock(detail.opened.at)}
          {detail.opened.from_alert ? ` from ${detail.opened.from_alert}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2.5">{actions}</div>
    </div>
  );
}

/** C1 · “Opened automatically … Start investigating”. */
export function StartBanner({ detail, onStart, busy }: { detail: CaseDetail; onStart: () => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-brand-primary-subtle px-4 py-3">
      <Icon name="app/icon-zap-brand-20" size={20} />
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-label-m text-text-brand">
          {detail.opened.from_alert
            ? `Opened automatically from ${detail.severity} alert ${detail.opened.from_alert} and assigned to you`
            : "Assigned to you and not started yet"}
        </p>
        <p className="text-body-s text-text-primary">Starting moves it to Investigating and stops the first-response clock.</p>
      </div>
      <Button size="md" onClick={onStart} loading={busy} iconLeft={<Icon name="app/icon-play-white-18" size={18} />}>
        Start investigating
      </Button>
    </div>
  );
}

const MONEY_LABEL: Record<CaseDetail["glance"]["money"]["label"], string> = {
  money_at_stake: "Money at stake",
  money_out: "Money out",
  being_recovered: "Being recovered",
  recovered: "Recovered",
  lost: "Lost",
};

const FAMILY: Record<string, string> = {
  sim_swap_to_momo: "Account takeover",
  account_takeover: "Account takeover",
  momo_velocity: "MoMo fraud",
  agent_cash_out: "Agent fraud",
  sim_box_bypass: "Interconnect bypass",
  wangiri: "Call fraud",
};

/** Risk · What it is · Money · First response — 122 high. */
export function GlanceTiles({ detail, now }: { detail: CaseDetail; now: number }) {
  const g = detail.glance;
  const fr = g.first_response;
  const dueIn = Math.round((Date.parse(detail.opened.at) + fr.sla_minutes * 60_000 - now) / 60_000);
  const tile = "flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border px-[18px] py-4";
  return (
    <div className="flex h-[122px] gap-3">
      <div className={cn(tile, "border-critical-border bg-critical-bg")}>
        <span className="text-overline text-text-tertiary uppercase">Risk</span>
        <span className="text-h2 text-critical-fg">{g.risk_score} / 100</span>
        <span className="h-1.5 w-[200px] max-w-full overflow-hidden rounded-[3px] bg-surface-base" aria-hidden>
          <span className="block h-1.5 rounded-[3px] bg-critical-fg" style={{ width: `${g.risk_score}%` }} />
        </span>
        <span className="text-caption font-medium text-text-secondary">{g.rules_fired} rules fired</span>
      </div>
      <div className={cn(tile, "border-border-subtle bg-surface-base")}>
        <span className="text-overline text-text-tertiary uppercase">What it is</span>
        <span className="truncate text-h2 text-text-primary">{fraudTypeLabel(g.fraud_type)}</span>
        <span className="text-caption font-medium text-text-secondary">{FAMILY[g.fraud_type] ?? "Fraud"}</span>
      </div>
      <div className={cn(tile, g.money.label === "recovered" ? "border-success-border bg-success-bg" : "border-high-border bg-high-bg")}>
        <span className="text-overline text-text-tertiary uppercase">{MONEY_LABEL[g.money.label]}</span>
        <span className={cn("text-h2", g.money.label === "recovered" ? "text-success-fg" : "text-high-fg")}>
          {formatMoney(g.money.amount.amount_minor, g.money.amount.currency)}
        </span>
        <span className="truncate text-caption font-medium text-text-secondary">{g.money.note}</span>
      </div>
      <div
        className={cn(
          tile,
          fr.minutes !== null
            ? fr.met
              ? "border-success-border bg-success-bg"
              : "border-critical-border bg-critical-bg"
            : dueIn < 0
              ? "border-critical-border bg-critical-bg"
              : "border-medium-border bg-medium-bg",
        )}
      >
        <span className="text-overline text-text-tertiary uppercase">First response</span>
        <span
          className={cn(
            "text-h2",
            fr.minutes !== null ? (fr.met ? "text-success-fg" : "text-critical-fg") : dueIn < 0 ? "text-critical-fg" : "text-medium-fg",
          )}
        >
          {fr.minutes !== null ? `${fr.met ? "Met" : "Missed"} · ${fr.minutes} min` : dueIn < 0 ? `Late · ${-dueIn} min` : `Due in ${dueIn} min`}
        </span>
        <span className="text-caption font-medium text-text-secondary">SLA {fr.sla_minutes} min</span>
      </div>
    </div>
  );
}
