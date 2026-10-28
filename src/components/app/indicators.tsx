"use client";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { CaseStatus, Severity } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatSpan } from "@/lib/time";

/** Risk levels: Critical 90+, High 70-89, Medium 40-69, Low under 40. */
export function riskTone(score: number): Severity {
  return score >= 90 ? "critical" : score >= 70 ? "high" : score >= 40 ? "medium" : "low";
}

const TONE_TEXT: Record<Severity, string> = {
  critical: "text-critical-fg",
  high: "text-high-fg",
  medium: "text-medium-fg",
  low: "text-text-secondary",
};

/** Risk pill — score + level pill (risk in tables is always this). */
export function RiskScore({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-6 text-right text-body-s text-text-primary tabular-nums">{score}</span>
      <SeverityBadge severity={riskTone(score)} />
    </span>
  );
}

const SEVERITY: Record<Severity, { label: string; tone: BadgeTone }> = {
  critical: { label: "Critical", tone: "critical" },
  high: { label: "High", tone: "high" },
  medium: { label: "Medium", tone: "medium" },
  low: { label: "Low", tone: "neutral" },
};

export function SeverityBadge({ severity, dot = true, size }: { severity: Severity; dot?: boolean; size?: "sm" | "md" }) {
  const s = SEVERITY[severity];
  return <Badge label={s.label} tone={s.tone} dot={dot} size={size} />;
}

/** Text colour for a risk score number. */
export const riskText = (score: number) => TONE_TEXT[riskTone(score)];

const CASE_STATUS: Record<CaseStatus, { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "neutral" },
  investigating: { label: "Investigating", tone: "brand" },
  escalated: { label: "Escalated", tone: "high" },
  sent_back: { label: "Sent back", tone: "medium" },
  pending_decision: { label: "Pending decision", tone: "info" },
  closed: { label: "Closed", tone: "neutral" },
  reopened: { label: "Reopened", tone: "high" },
};

export const caseStatusLabel = (s: CaseStatus) => CASE_STATUS[s]?.label ?? s;

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const s = CASE_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge label={s.label} tone={s.tone} dot />;
}

/** SLA countdown: medium under 30 min, critical once breached. */
export function SlaLabel({ dueAt, now, prefix }: { dueAt: string; now: number; prefix?: string }) {
  const left = Date.parse(dueAt) - now;
  if (left < 0) {
    return (
      <span className="flex items-center gap-1.5 text-label-s text-critical-fg">
        <Icon name="app/icon-alert-circle-critical-14" size={14} />
        Breached {formatSpan(left)}
      </span>
    );
  }
  const urgent = left < 30 * 60_000;
  return (
    <span className={cn("flex items-center gap-1.5 text-label-s", urgent ? "text-medium-fg" : "text-text-secondary")}>
      <Icon name={urgent ? "app/icon-timer-medium-14" : "app/icon-timer-tertiary-14"} size={14} />
      {prefix}
      {formatSpan(left)}
      {urgent ? " left" : ""}
    </span>
  );
}
