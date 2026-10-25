"use client";

import { Card } from "@/components/app/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { fraudTypeLabel } from "@/lib/api/fd";
import type { CaseDetail } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, formatWhen } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";

const OUTCOME_BADGE = {
  confirmed_fraud: { label: "Confirmed fraud", tone: "critical" as const },
  false_positive: { label: "False positive", tone: "success" as const },
  inconclusive: { label: "Inconclusive", tone: "neutral" as const },
};

export const outcomeBadge = (o: keyof typeof OUTCOME_BADGE) => OUTCOME_BADGE[o];

/** E3 · Waiting for sign-off — read-only until it’s reviewed. */
export function SignoffBanner({ detail }: { detail: CaseDetail }) {
  const { mutate } = useSWRConfig();
  const r = detail.resolution;
  if (!r || r.status !== "pending_decision") return null;
  const m = (x?: { amount_minor: number; currency: string }) => (x ? formatMoney(x.amount_minor, x.currency) : "–");
  return (
    <Banner
      tone="warning"
      icon="app/icon-clock-medium-20"
      title={`Waiting for sign-off from ${r.reviewer?.name ?? "your supervisor"}`}
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            // TODO(api): proposed DELETE /cases/{id}/resolution (withdraw before review).
            await apiFetch("DELETE", `/cases/${detail.id}/resolution`).catch(() => undefined);
            await mutate(`/cases/${detail.id}`);
          }}
        >
          Withdraw submission
        </Button>
      }
    >
      Submitted {formatClock(r.resubmitted_at ?? r.submitted_at)} as {OUTCOME_BADGE[r.outcome].label}
      {r.amount_lost ? ` · ${m(r.amount_lost)} lost` : ""}
      {r.amount_recovered ? ` · ${m(r.amount_recovered)} recovered` : ""}. The case is read-only while it’s reviewed.
    </Banner>
  );
}

/** E4 · Sent back — what the supervisor asked for, and where to do it. */
export function SentBackBanner({ detail, onEvidence }: { detail: CaseDetail; onEvidence: () => void }) {
  const r = detail.resolution;
  if (!r || r.status !== "sent_back" || !r.sent_back) return null;
  return (
    <section className="flex items-center gap-3 rounded-xl border border-high-border bg-high-bg px-4 py-3">
      <Avatar initials={r.reviewer?.initials ?? "EO"} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-label-m text-high-fg">
          {r.reviewer?.name.split(" ")[0]} sent this back · {formatClock(r.sent_back.at)}
        </p>
        <p className="text-body-s text-text-primary">“{r.sent_back.comment}”</p>
      </div>
      <Button size="sm" onClick={onEvidence}>
        Go to Evidence
      </Button>
      {/* TODO(api): no messaging endpoint. */}
      <Button variant="secondary" size="sm" disabled title="Messaging isn’t available yet" iconLeft={<Icon name="app/icon-message-18" size={16} />}>
        Reply
      </Button>
    </section>
  );
}

/** E6/E9 · Closed — the resolution as it stands on the record. */
export function ResolutionCard({ detail, now }: { detail: CaseDetail; now: number }) {
  const toast = useToast();
  const r = detail.resolution;
  if (!r || r.status !== "closed") return null;
  const b = OUTCOME_BADGE[r.outcome];
  const lost = r.amount_lost?.amount_minor ?? 0;
  const back = r.amount_recovered?.amount_minor ?? 0;
  const cells: Array<[string, string, string?]> =
    r.outcome === "confirmed_fraud"
      ? [
          ["Lost", formatMoney(lost, "GHS"), "text-critical-fg"],
          ["Recovered", formatMoney(back, "GHS"), "text-success-fg"],
          ["Net loss", formatMoney(lost - back, "GHS")],
          ["Linked", [...(r.linked ?? []), ...detail.linked_cases].filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "None"],
          ["Regulator report", r.regulator_report ? `Filed · ${r.regulator_report}` : "Not needed"],
        ]
      : r.outcome === "false_positive"
        ? [
            ["Amount at risk", formatMoney(detail.glance.money.amount.amount_minor, "GHS")],
            ["Rule feedback", r.rule_feedback !== undefined ? "R-118 · sent" : "Not sent", "text-text-brand"],
            ["Watchlist", "Not added"],
            ["Subscriber contacted", detail.next_steps.done.includes("call_subscriber") ? "Yes" : "No"],
          ]
        : [
            ["Watching", `${r.watch_days ?? 30} days`],
            ["Reopens on a repeat", r.reopen_on_repeat ? "Yes" : "No"],
            ["Amount at risk", formatMoney(detail.glance.money.amount.amount_minor, "GHS")],
          ];
  return (
    <Card
      title="Resolution"
      icon="app/icon-check-circle-secondary-18"
      aside={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => toast({ tone: "success", title: "Case report on its way", body: `${detail.id} · PDF, logged with your name.` })}
          iconLeft={<Icon name="app/icon-download-18" size={16} />}
        >
          Download case report
        </Button>
      }
    >
      <p className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
        <Badge label={b.label} tone={b.tone} />
        {r.signed_off
          ? `Signed off by ${r.signed_off.by} · ${formatClock(r.signed_off.at)} · submitted by ${r.submitted_by.name}`
          : `Closed by ${r.submitted_by.name} · ${formatWhen(r.submitted_at, now)} · no sign-off needed`}
      </p>
      <p className="text-body-m text-text-primary">{r.summary}</p>
      <div className="flex">
        {cells.map(([k, v, tone]) => (
          <div key={k} className="flex flex-1 flex-col gap-1">
            <span className="text-caption text-text-secondary">{k}</span>
            <span className={cn("text-h3", tone ?? "text-text-primary")}>{v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** E9 · “Thanks: this helps cut false alarms”. */
export function FeedbackThanks({ detail }: { detail: CaseDetail }) {
  if (detail.resolution?.outcome !== "false_positive" || detail.resolution.status !== "closed") return null;
  return (
    <Banner tone="success" title="Thanks: this helps cut false alarms">
      R-118 flagged 9 verified in-branch device changes this week. The rules team will review it; you’ll be notified of changes.
    </Banner>
  );
}

/** E7/E9 · One-line summary used where the glance tiles would repeat the obvious. */
export function CompactStrip({ detail, now }: { detail: CaseDetail; now: number }) {
  const [copied, setCopied] = useState(false);
  const r = detail.resolution;
  const closedIn = r?.status === "closed" ? Math.round((Date.parse(r.submitted_at) - Date.parse(detail.opened.at)) / 60_000) : null;
  const cells: Array<[string, React.ReactNode]> = [
    [
      "Subscriber",
      <span key="s" className="flex items-center gap-1.5 font-mono text-mono-m">
        {detail.subject.msisdn}
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy number"}
          onClick={() => {
            void navigator.clipboard?.writeText(detail.subject.msisdn).then(() => setCopied(true));
          }}
          className="flex rounded"
        >
          <Icon name="app/icon-copy-primary-20" size={14} />
        </button>
      </span>,
    ],
    ["Fraud type", fraudTypeLabel(detail.glance.fraud_type)],
    [
      "Risk",
      <span key="r" className="flex items-center gap-2">
        <span className="text-label-m text-medium-fg">{detail.glance.risk_score}</span>
        <span className="h-1 w-[46px] rounded-[2px] bg-medium-bg">
          <span className="block h-1 rounded-[2px] bg-medium-fg" style={{ width: `${detail.glance.risk_score}%` }} />
        </span>
      </span>,
    ],
    [
      "Assignee",
      <span key="a" className="flex items-center gap-2">
        {detail.assignee && <Avatar initials={detail.assignee.initials} />}
        {detail.assignee?.name ?? "Team queue"}
      </span>,
    ],
    ["Opened", `${formatWhen(detail.opened.at, now, { withTime: true })}${detail.opened.from_alert ? ` · from ${detail.opened.from_alert}` : ""}`],
    [
      closedIn !== null ? "Time to close" : "SLA · close",
      <span key="t" className={cn("flex items-center gap-1.5", detail.sla?.tone === "medium" ? "text-medium-fg" : undefined)}>
        <Icon name={detail.sla?.tone === "medium" ? "app/icon-timer-medium-14" : "app/icon-timer-tertiary-14"} size={14} />
        {closedIn !== null ? `Closed in ${closedIn} min` : detail.sla?.label ?? "On track"}
      </span>,
    ],
  ];
  return (
    <div className="flex items-center rounded-xl border border-border-subtle bg-surface-base px-5 py-3.5">
      {cells.map(([label, value], i) => (
        <div key={label} className={cn("flex flex-1 flex-col gap-1.5 px-4 first:pl-0", i < cells.length - 1 && "border-r border-border-subtle")}>
          <span className="text-caption text-text-secondary">{label}</span>
          <span className="text-body-m text-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}

/** E7 · Outcome rejected — the case is back with you, with what you submitted and what to check. */
export function RejectedBanner({ detail }: { detail: CaseDetail }) {
  const j = detail.rejection;
  if (!j) return null;
  return (
    <section className="flex items-start gap-3 rounded-xl border border-critical-border bg-critical-bg px-4 py-3">
      <Avatar initials={j.by.initials} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-label-m text-critical-fg">{j.by.name.split(" ")[0]} rejected your outcome</span>
          <span className="text-caption text-text-tertiary">
            {formatClock(j.at)} · you proposed: {OUTCOME_BADGE[j.proposed as "confirmed_fraud"]?.label ?? j.proposed}
          </span>
        </p>
        <p className="max-w-[760px] text-body-s text-text-primary">{j.comment}</p>
      </div>
      {/* TODO(api): no messaging endpoint. */}
      <Button variant="secondary" size="sm" disabled title="Messaging isn’t available yet" iconLeft={<Icon name="app/icon-message-18" size={16} />}>
        Reply
      </Button>
    </section>
  );
}

export function RejectedSummary({ detail }: { detail: CaseDetail }) {
  const j = detail.rejection;
  const [done, setDone] = useState<number[]>([]);
  if (!j) return null;
  return (
    <div className="flex items-start gap-4">
      <Card title="What you submitted" icon="app/icon-file-secondary-18" className="min-w-0 flex-1">
        <div className="w-fit">
          <Badge label={OUTCOME_BADGE[j.proposed as "confirmed_fraud"]?.label ?? j.proposed} tone="critical" />
        </div>
        <p className="text-body-s text-text-primary">{j.submitted.summary}</p>
        <KeyValueList rows={j.submitted.facts.map(([k, v, tone]) => [k, <span key={k} className={tone === "medium" ? "text-medium-fg" : undefined}>{v}</span>])} />
      </Card>
      <Card title="Next steps" icon="app/icon-check-circle-secondary-18" className="w-[400px] shrink-0">
        <ul className="flex flex-col gap-3">
          {j.steps.map((step, i) => (
            <li key={step}>
              <label className="flex cursor-pointer items-center gap-3 text-body-s text-text-primary">
                <input
                  type="checkbox"
                  checked={done.includes(i)}
                  onChange={(e) => setDone((d) => (e.target.checked ? [...d, i] : d.filter((x) => x !== i)))}
                  className="size-[18px] cursor-pointer appearance-none rounded-full border-[1.5px] border-border-strong checked:border-[5px] checked:border-success-fg"
                />
                <span className={done.includes(i) ? "text-text-secondary line-through" : undefined}>{step}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
