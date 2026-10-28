"use client";

import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SeverityBadge } from "@/components/app/indicators";
import { STAGES, type CaseDetail } from "@/lib/api/cases";
import { useMyCases } from "@/lib/api/fd";
import { useRevealed } from "@/lib/api/reveal";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { BannerLink, localMsisdn, whenAt } from "./parts";

const OUTCOME = {
  confirmed_fraud: { label: "Confirmed fraud", tone: "critical" as const },
  false_positive: { label: "False positive", tone: "success" as const },
  inconclusive: { label: "Inconclusive", tone: "neutral" as const },
};

/** Case / Stage bar · Alert ✓ — Investigate ◉ — Act ○ — Decide ○ — Closed ○ — Monitor ○ */
export function StageBar({ stage, status }: { stage: CaseDetail["stage"]; status: CaseDetail["status"] }) {
  const at = (id: string) => STAGES.findIndex((s) => s.id === id);
  const current =
    stage === "monitor"
      ? at("monitor")
      : status === "closed"
        ? at("closed")
        : status === "pending_decision" || status === "sent_back"
          ? at("decide")
          : status === "new"
            ? 0
            : Math.max(1, at(stage));
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
              <span className={cn(now ? "text-label-s text-text-brand" : "text-body-s", done ? "text-text-secondary" : !now && "text-text-tertiary")}>{s.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Previous · Next case — moves through my open cases. `before` holds the Export menu (E12). */
export function CaseNav({ caseId, before }: { caseId: string; before?: ReactNode }) {
  const { data } = useMyCases();
  const ids = data?.data.map((c) => c.id) ?? [];
  const i = ids.indexOf(caseId);
  const prev = i > 0 ? ids[i - 1] : null;
  const next = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  const left = <Icon name="app/icon-chevron-left-16" size={16} />;
  const right = <Icon name="app/icon-chevron-right-16" size={16} />;
  return (
    <div className="flex items-center gap-2">
      {before}
      {prev ? (
        <ButtonLink href={`/cases/${prev}`} variant="secondary" size="sm" iconLeft={left}>
          Previous
        </ButtonLink>
      ) : (
        <Button variant="secondary" size="sm" disabled iconLeft={left}>
          Previous
        </Button>
      )}
      {next ? (
        <ButtonLink href={`/cases/${next}`} variant="secondary" size="sm" iconRight={right}>
          Next case
        </ButtonLink>
      ) : (
        <Button variant="secondary" size="sm" disabled iconRight={right}>
          Next case
        </Button>
      )}
    </div>
  );
}

/**
 * Page header for a case — “FD-3050 ● Critical”, then “Kojo M. · 054 *** 3457 ·
 * assigned to you · opened 09:25 from AL-88213 · risk 97”, ≤2 actions on the right.
 * Closed cases show the outcome pill and who signed off instead.
 */
export function CaseTitle({
  detail,
  meId,
  now,
  onOpenSubscriber,
  onReveal,
  actions,
}: {
  detail: CaseDetail;
  meId?: string;
  now: number;
  onOpenSubscriber: () => void;
  onReveal: () => void;
  actions: ReactNode;
}) {
  const revealed = useRevealed(detail.subject.subscriber_id);
  const r = detail.status === "closed" ? detail.resolution : null;
  const assigned = !detail.assignee ? "in the team queue" : detail.assignee.id === meId ? "assigned to you" : `assigned to ${detail.assignee.name}`;
  const signer = r?.signed_off_by;
  const tail = r
    ? [`closed ${whenAt(r.closed_at, now)}${signer ? "" : detail.assignee ? ` by ${detail.assignee.id === meId ? "you" : detail.assignee.name}` : ""}`, signer && `signed off by ${signer.name}`]
    : [assigned, `opened ${whenAt(detail.opened.at, now)}${detail.opened.from_alert ? ` from ${detail.opened.from_alert}` : ""}`, `risk ${detail.glance.risk_score}`];
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="flex items-center gap-2 text-h2 text-text-primary">
          {detail.id}
          {r ? <Badge label={OUTCOME[r.outcome].label} tone={OUTCOME[r.outcome].tone} size="md" /> : <SeverityBadge severity={detail.severity} size="md" />}
        </h2>
        <p className="flex flex-wrap items-center gap-x-1 text-body-s text-text-secondary">
          <button type="button" onClick={onOpenSubscriber} className="rounded hover:text-text-brand hover:underline">
            {revealed?.values.name ?? detail.subject.name}
          </button>
          <span>·</span>
          <span>{revealed?.values.msisdn ?? localMsisdn(detail.subject.msisdn)}</span>
          {!revealed && (
            <button type="button" onClick={onReveal} aria-label="Reveal personal details" className="flex rounded">
              <Icon name="app/icon-eye-secondary-16" size={14} />
            </button>
          )}
          {tail.filter(Boolean).map((t) => (
            <span key={String(t)}>· {t}</span>
          ))}
        </p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

/** C1 · “Opened automatically … Start investigating” — or, in the team queue, “Pick up”. */
export function StartBanner({ detail, onStart, busy }: { detail: CaseDetail; onStart: () => void; busy: boolean }) {
  const queued = !detail.assignee;
  return (
    <Banner
      tone="info"
      title={
        queued
          ? `Unassigned in the team queue${detail.opened.from_alert ? ` · from ${detail.severity} alert ${detail.opened.from_alert}` : ""}`
          : detail.opened.from_alert
            ? `Opened automatically from ${detail.severity} alert ${detail.opened.from_alert} and assigned to you`
            : "Assigned to you and not started yet"
      }
      action={
        <BannerLink onClick={onStart} busy={busy}>
          {busy ? "Starting…" : queued ? "Pick up" : "Start investigating"}
        </BannerLink>
      }
    >
      {queued ? "Pick it up to make it yours, then start investigating." : "Starting moves it to Investigating and stops the first-response clock."}
    </Banner>
  );
}
