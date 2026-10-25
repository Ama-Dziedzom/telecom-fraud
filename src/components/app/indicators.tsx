"use client";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { CaseStatus, Severity } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatSpan } from "@/lib/time";

/** Risk score colour bands used across tables and drawers. */
export function riskTone(score: number): "critical" | "high" | "medium" {
  return score >= 90 ? "critical" : score >= 70 ? "high" : "medium";
}

const TONE_TEXT = { critical: "text-critical-fg", high: "text-high-fg", medium: "text-medium-fg" };
const TONE_FILL = { critical: "bg-critical-fg", high: "bg-high-fg", medium: "bg-medium-fg" };
const TONE_TRACK = { critical: "bg-critical-bg", high: "bg-high-bg", medium: "bg-medium-bg" };

/** “97 ▬▬▬” — score plus a 44px bar. */
export function RiskScore({ score }: { score: number }) {
  const tone = riskTone(score);
  return (
    <span className="flex items-center gap-2">
      <span className={cn("text-label-m", TONE_TEXT[tone])}>{score}</span>
      <span className={cn("h-1 w-11 rounded-[2px]", TONE_TRACK[tone])} aria-hidden>
        <span className={cn("block h-1 rounded-[2px]", TONE_FILL[tone])} style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}

const SEVERITY: Record<Severity, { label: string; tone: BadgeTone }> = {
  critical: { label: "Critical", tone: "critical" },
  high: { label: "High", tone: "high" },
  medium: { label: "Medium", tone: "medium" },
  low: { label: "Low", tone: "neutral" },
};

export function SeverityBadge({ severity, dot = false, size }: { severity: Severity; dot?: boolean; size?: "sm" | "md" }) {
  const s = SEVERITY[severity];
  return <Badge label={s.label} tone={s.tone} dot={dot} size={size} />;
}

/** Text colour for a risk score number. */
export const riskText = (score: number) => TONE_TEXT[riskTone(score)];

const CASE_STATUS: Record<CaseStatus, { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "info" },
  investigating: { label: "Investigating", tone: "brand" },
  escalated: { label: "Escalated", tone: "critical" },
  sent_back: { label: "Sent back", tone: "high" },
  pending_decision: { label: "Pending decision", tone: "medium" },
  closed: { label: "Closed", tone: "neutral" },
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
