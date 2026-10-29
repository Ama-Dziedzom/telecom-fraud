"use client";

import { Card } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { apiFetch } from "@/lib/api/client";
import type { CaseDetail } from "@/lib/api/cases";
import { formatClock, formatMoney } from "@/lib/time";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { BannerLink, DetailRows, StatTile, firstName, whenAt } from "./parts";

const OUTCOME_BADGE = {
  confirmed_fraud: { label: "Confirmed fraud", tone: "critical" as const },
  false_positive: { label: "False positive", tone: "success" as const },
  inconclusive: { label: "Inconclusive", tone: "neutral" as const },
};

export const outcomeBadge = (o: keyof typeof OUTCOME_BADGE) => OUTCOME_BADGE[o];

const money = (m: { amount_minor: number; currency: string }) => formatMoney(m.amount_minor, m.currency);
const bannerOf = (detail: CaseDetail, kind: string) => detail.banners.find((b) => b.kind === kind);
const submittedStep = (detail: CaseDetail) => detail.what_happened.findLast((s) => s.kind === "submitted");

/** E3 · Waiting for sign-off — read-only until it’s reviewed. */
export function SignoffBanner({ detail }: { detail: CaseDetail }) {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  if (detail.status !== "pending_decision") return null;
  const b = bannerOf(detail, "pending_decision");
  // What was proposed is on the “Submitted for sign-off” step; its detail is engine text.
  const submitted = submittedStep(detail);
  const at = b?.at ?? submitted?.at;
  return (
    <Banner
      tone="info"
      title={b?.title ?? "Waiting for sign-off from your supervisor"}
      action={
        <BannerLink
          busy={busy}
          onClick={async () => {
            setBusy(true);
            await apiFetch("DELETE", `/cases/${detail.id}/resolution`).catch(() => undefined);
            await mutate(`/cases/${detail.id}`);
            setBusy(false);
          }}
        >
          Withdraw submission
        </BannerLink>
      }
    >
      Submitted{at ? ` ${formatClock(at)}` : ""}
      {submitted?.detail ? ` as ${submitted.detail}` : ""}. The case is read-only while it waits.
    </Banner>
  );
}

/** E4 · Sent back — what the supervisor asked for. The step to do it is in Do this next. */
export function SentBackBanner({ detail }: { detail: CaseDetail }) {
  const b = bannerOf(detail, "sent_back");
  if (detail.status !== "sent_back" || !b) return null;
  return (
    <Banner
      tone="warning"
      title={`${firstName(b.by?.name) || "Your supervisor"} sent this back${b.at ? ` · ${formatClock(b.at)}` : ""}`}
      // TODO(api): no messaging endpoint.
      action={
        <BannerLink disabled title="Messaging isn’t available yet">
          Reply
        </BannerLink>
      }
    >
      “{b.detail}”
    </Banner>
  );
}

/** E6/E9 · Closed — the resolution as it stands on the record, with its figures. */
export function ResolutionCard({ detail, now }: { detail: CaseDetail; now: number }) {
  const r = detail.resolution;
  if (!r || detail.status !== "closed") return null;
  const b = OUTCOME_BADGE[r.outcome];
  const watch = detail.monitoring;
  const transfers = detail.what_happened.find((s) => s.kind === "payments_out")?.label.match(/\d+/)?.[0];
  const tiles: Array<[string, ReactNode, ReactNode?]> =
    r.outcome === "confirmed_fraud"
      ? [
          ["Lost", money(r.lost), transfers ? `${transfers} transfers` : undefined],
          ["Recovered", money(r.recovered), detail.reversal?.id],
          ["Net loss", money(r.net_loss)],
          ["Linked", detail.linked_cases.join(", ") || "None", detail.linked_cases.length ? "Same ring" : undefined],
          ["Regulator report", r.regulator_reference ? "Filed" : "Not needed", r.regulator_reference ?? undefined],
        ]
      : r.outcome === "false_positive"
        ? [
            ["Amount at risk", money(r.net_loss), r.net_loss.amount_minor === 0 ? "No loss" : undefined],
            ["Watchlist", watch ? `${watch.entities.length} on watch` : "Not added"],
            ["Subscriber contacted", detail.next_steps.done.includes("call_subscriber") ? "Yes" : "No"],
          ]
        : [
            ["Watching", watch ? `${watch.days_total} days` : "Not watched", watch ? `${watch.days_left} days left` : undefined],
            ["Reopens on a repeat", watch?.reopen_on_repeat ? "Yes" : "No"],
            ["Amount at risk", money(detail.glance.money.amount)],
          ];
  const signers = [r.signed_off_by, r.co_signed_by].filter((p) => p !== null).map((p) => p.name);
  return (
    <Card
      title="Resolution"
      aside={
        <button
          type="button"
          onClick={() => window.open(`/print/cases/${detail.id}`, "_blank")}
          className="flex h-8 items-center rounded text-label-s text-text-brand hover:underline"
        >
          Download case report
        </button>
      }
    >
      <p className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
        <Badge label={b.label} tone={b.tone} />
        {signers.length
          ? `Signed off by ${signers.join(" and ")} ${whenAt(r.closed_at, now)}${detail.assignee ? ` · submitted by ${detail.assignee.name}` : ""}`
          : `Closed${detail.assignee ? ` by ${detail.assignee.name}` : ""} ${whenAt(r.closed_at, now)} · no sign-off needed`}
      </p>
      <p className="text-body-s text-text-primary">{r.summary}</p>
      <div className="flex gap-3">
        {tiles.map(([k, v, sub]) => (
          <StatTile key={k} label={k} value={v} sub={sub} />
        ))}
      </div>
    </Card>
  );
}

/** E9 · “Thanks: this helps cut false alarms”. */
export function FeedbackThanks({ detail }: { detail: CaseDetail }) {
  if (detail.resolution?.outcome !== "false_positive" || detail.status !== "closed") return null;
  return (
    <Banner tone="success" title="Thanks: this helps cut false alarms">
      Your feedback went to the rules team with this case attached. You’ll be told of changes.
    </Banner>
  );
}

/** E7 · Outcome rejected — the case is back with you. */
export function RejectedBanner({ detail }: { detail: CaseDetail }) {
  const j = detail.rejection;
  if (!j) return null;
  return (
    <Banner
      tone="error"
      title={`${firstName(j.by.name)} rejected your outcome · ${formatClock(j.at)}`}
      // TODO(api): no messaging endpoint.
      action={
        <BannerLink disabled title="Messaging isn’t available yet">
          Reply
        </BannerLink>
      }
    >
      “{j.comment}”
    </Banner>
  );
}

/** E7 · What you submitted — the proposed outcome and the facts it rested on. */
export function RejectedSummary({ detail }: { detail: CaseDetail }) {
  const j = detail.rejection;
  if (!j) return null;
  const b = OUTCOME_BADGE[j.proposed] ?? { label: j.proposed, tone: "critical" as const };
  const submitted = submittedStep(detail);
  return (
    <Card title="What you submitted">
      <p className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
        <Badge label={b.label} tone={b.tone} />
        {[submitted && `Submitted ${formatClock(submitted.at)}`, `rejected ${formatClock(j.at)}`].filter(Boolean).join(" · ")}
      </p>
      <p className="text-body-s text-text-primary">{j.submitted.summary}</p>
      <DetailRows rows={j.submitted.facts.map((f) => [f.label, f.value])} />
    </Card>
  );
}
