"use client";

import { Card } from "@/components/app/Card";
import { NetworkGraph } from "@/components/network/NetworkGraph";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { NEXT_STEP_LABELS, useNetwork, type CaseDetail, type NextStepKind, type StoryStep } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";

const STEP: Record<string, { icon: string; tile: string; risky?: boolean }> = {
  sim_swap: { icon: "app/icon-sim-high-20", tile: "bg-high-bg" },
  new_device: { icon: "app/icon-phone-high-20", tile: "bg-high-bg", risky: true },
  payments_out: { icon: "app/icon-send-critical-20", tile: "bg-critical-bg", risky: true },
  wallets_paid: { icon: "app/icon-users-critical-20", tile: "bg-critical-bg", risky: true },
  alert_raised: { icon: "app/icon-alert-triangle-brand-20", tile: "bg-brand-primary-subtle" },
  picked_up: { icon: "app/icon-user-brand-20", tile: "bg-brand-primary-subtle" },
};

/** What happened — a horizontal story, one 216-wide step per event. */
export function StoryStrip({ steps }: { steps: StoryStep[] }) {
  return (
    <Card title="What happened" icon="app/icon-history-18">
      <ol className="flex overflow-x-auto">
        {steps.map((s, i) => {
          const style = STEP[s.kind] ?? STEP.alert_raised;
          const red = s.kind === "payments_out" || s.kind === "wallets_paid";
          return (
            <li key={i} className="flex w-[216px] shrink-0 flex-col gap-1.5">
              <span className="flex items-center">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[10px]", style.tile)}>
                  <Icon name={style.icon} size={20} />
                </span>
                {i < steps.length - 1 && (
                  <span aria-hidden className={cn("h-0.5 w-[176px]", style.risky ? "bg-critical-border" : "bg-border-default")} />
                )}
              </span>
              <span className="font-mono text-mono-s text-text-tertiary">{formatClock(s.at)}</span>
              <span className="w-48 text-label-m text-text-primary">{s.label}</span>
              <span className={cn("w-48 text-caption", red ? "text-critical-fg" : "text-text-secondary")}>
                {s.amount ? `${formatMoney(s.amount.amount_minor, s.amount.currency)} total` : s.detail}
              </span>
              {s.links?.length ? <Badge label={`${s.links.length} linked to ${s.links.join(", ")}`} tone="critical" /> : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

const STEP_ICON: Record<NextStepKind, { tile: string; button: string }> = {
  freeze_wallet: { tile: "app/icon-shield-brand-24", button: "app/icon-shield-white-20" },
  suspend_sim: { tile: "app/icon-shield-brand-24", button: "app/icon-shield-white-20" },
  block_recipients: { tile: "app/icon-shield-brand-24", button: "app/icon-shield-white-20" },
  call_subscriber: { tile: "app/icon-phone-brand-24", button: "app/icon-phone-white-20" },
  request_reversal: { tile: "app/icon-refresh-brand-24", button: "app/icon-refresh-white-20" },
  report_agent: { tile: "app/icon-building-brand-24", button: "app/icon-building-white-20" },
  add_evidence: { tile: "app/icon-file-brand-24", button: "app/icon-file-white-20" },
  await_signoff: { tile: "app/icon-clock-brand-24", button: "app/icon-clock-white-20" },
  watch_repeat: { tile: "app/icon-eye-brand-24", button: "app/icon-eye-white-20" },
};

/** Do this next — the recommended step big, the rest as “Then” chips. */
export function DoThisNext({
  steps,
  onStep,
  locked,
}: {
  steps: CaseDetail["next_steps"];
  onStep: (kind: NextStepKind) => void;
  locked?: boolean;
}) {
  const total = steps.done.length + steps.remaining.length + (steps.recommended ? 1 : 0);
  const rec = steps.recommended;
  return (
    <Card
      title="Do this next"
      icon="app/icon-zap-secondary-18"
      aside={
        <Badge
          label={rec && ["await_signoff", "watch_repeat", "add_evidence"].includes(rec.kind) ? "Response complete" : `${steps.done.length} of ${total} done`}
          tone="neutral"
        />
      }
      className="min-w-0 flex-1 self-stretch"
    >
      {rec ? (
        <div className="flex items-center gap-4 rounded-xl border border-brand-primary bg-brand-primary-subtle px-5 py-[18px]">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-brand-primary-subtle">
            <Icon name={STEP_ICON[rec.kind].tile} size={24} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-h3 text-text-primary">{rec.title}</span>
            <span className="text-body-m text-text-secondary">{rec.detail}</span>
          </span>
          <span className="flex-1" />
          <Button size="lg" disabled={locked && rec.kind !== "await_signoff" && rec.kind !== "watch_repeat"} onClick={() => onStep(rec.kind)} iconLeft={<Icon name={STEP_ICON[rec.kind].button} size={20} />}>
            {NEXT_STEP_LABELS[rec.kind]}
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-success-bg px-5 py-4 text-label-m text-success-fg">
          <Icon name="app/icon-check-circle-success-18" size={18} />
          All suggested steps are done. Resolve the case when you’re ready.
        </p>
      )}
      {(steps.remaining.length > 0 || steps.done.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-overline text-text-tertiary uppercase">Then</span>
          {steps.remaining.map((k) => (
            <button
              key={k}
              type="button"
              disabled={locked}
              onClick={() => onStep(k)}
              className="flex items-center gap-2 rounded-full bg-surface-raised px-3 py-2 text-label-s text-text-secondary hover:bg-surface-sunken disabled:cursor-not-allowed"
            >
              <Icon name="app/icon-circle-dashed-14" size={14} />
              {NEXT_STEP_LABELS[k]}
            </button>
          ))}
          {steps.done.map((k) => (
            <span key={k} className="flex items-center gap-2 rounded-full bg-success-bg px-3 py-2 text-label-s text-success-fg">
              <Icon name="app/icon-check-circle-success-14" size={14} />
              {NEXT_STEP_LABELS[k]}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Who’s involved — the first hop of the network, with the cases it touches. */
export function WhoInvolved({ detail, onOpenNetwork }: { detail: CaseDetail; onOpenNetwork: () => void }) {
  const { data } = useNetwork(detail.subject.subscriber_id, 1);
  const network = data && {
    ...data,
    nodes: data.nodes.filter((n) => n.id === detail.subject.subscriber_id || (n.type !== "device" && n.id !== "agt_557210")).slice(0, 6),
  };
  const sameDevice = data?.nodes.filter((n) => n.type === "subscriber" && n.id !== detail.subject.subscriber_id).length ?? 0;
  return (
    <Card
      title="Who’s involved"
      icon="app/icon-network-secondary-18"
      aside={
        <Button variant="ghost" size="sm" onClick={onOpenNetwork} iconLeft={<Icon name="app/icon-network-brand-16" size={16} />}>
          Open network
        </Button>
      }
      className="w-[460px] shrink-0 self-stretch"
    >
      <div className="h-[230px]">
        {network ? (
          <NetworkGraph network={network} seed={detail.subject.subscriber_id} compact height={230} colWidth={125} />
        ) : (
          <p className="text-body-s text-text-secondary">Loading the network…</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {detail.linked_cases.slice(0, 1).map((id) => (
          <Badge key={id} label={`${id} · same wallet`} tone="critical" />
        ))}
        {sameDevice > 0 && <Badge label={`${sameDevice} more on this phone`} tone="high" />}
      </div>
    </Card>
  );
}

