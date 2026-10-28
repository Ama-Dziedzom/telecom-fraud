"use client";

import { SeverityBadge, riskTone } from "@/components/app/indicators";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { fraudTypeLabel, type Alert, type CaseSummary } from "@/lib/api/fd";
import type { HandoverChoice, ShiftHandover } from "@/lib/api/local";
import { formatClock, formatClockOrDay } from "@/lib/time";

/** Why each flagged case is here, in the app’s words. */
const CHOICE: Record<HandoverChoice, { icon: string; line: (from: string) => string }> = {
  hand_over: { icon: "app/icon-users-secondary-16", line: (from) => `${from} handed it to you` },
  watch: { icon: "app/icon-alert-circle-tertiary-14", line: (from) => `${from} asked you to watch it` },
  keep: { icon: "app/icon-user-secondary-16", line: (from) => `${from} is keeping it` },
};

/** Start and end of the shift the handover covers (operators work in Ghana time, which is UTC). */
function shiftWindow(h: ShiftHandover) {
  const day = h.at.slice(0, 10);
  const end = Date.parse(`${day}T${h.shift.ends}:00Z`);
  const start = Date.parse(`${day}T${h.shift.starts}:00Z`);
  return { start: start < end ? start : start - 86_400_000, end };
}

/** Stat tile — Caption label, H2 value, Caption sub-line. */
function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border-default bg-surface-raised px-4 py-3.5">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className="truncate text-h2 text-text-primary">{value}</span>
      <span className="text-caption text-text-tertiary">{sub}</span>
    </div>
  );
}

/** A7 · Start of shift · read the night handover */
export function NightHandoverDrawer({
  open,
  handover,
  cases,
  alerts,
  now,
  onDone,
}: {
  open: boolean;
  handover: ShiftHandover;
  /** My open cases, for the type and risk of the flagged ones and what breached overnight. */
  cases: CaseSummary[];
  /** Open alerts. */
  alerts: Alert[];
  now: number;
  onDone: () => void;
}) {
  const first = handover.from.name.split(" ")[0];
  const shift = handover.shift.name[0].toUpperCase() + handover.shift.name.slice(1);
  const hours = `${shift} shift ${handover.shift.starts}-${handover.shift.ends}`;
  const { start, end } = shiftWindow(handover);
  const breached = cases.filter((c) => {
    const due = Date.parse(c.sla_due_at);
    return due >= start && due <= end;
  });
  const untriaged = alerts.filter((a) => a.status === "new");
  const oldest = untriaged.length ? Math.min(...untriaged.map((a) => Date.parse(a.created_at))) : null;
  const flagged = handover.cases.length;

  return (
    <Drawer
      open={open}
      onClose={onDone}
      badges={<Badge label={`${shift} handover`} tone="neutral" size="md" />}
      title={`From ${handover.from.name} · ${formatClockOrDay(handover.at, now)}`}
      subtitle={`${hours} · ${flagged} ${flagged === 1 ? "case" : "cases"} flagged for you`}
      footer={
        <>
          {/* TODO(api): no messaging endpoint yet, so this can’t send anything. */}
          <Button variant="ghost" size="md" disabled title="Messaging colleagues isn’t available yet">
            Ask {first} a question
          </Button>
          <span className="flex-1" />
          <Button size="md" onClick={onDone}>
            Start my shift
          </Button>
        </>
      }
    >
      <p className="text-body-s text-text-primary">{handover.note}</p>
      <div className="flex gap-4">
        <Stat label="Breached overnight" value={breached.length ? breached.map((c) => c.id).join(", ") : "None"} sub={hours} />
        <Stat label="Alerts waiting" value={String(untriaged.length)} sub={oldest ? `Oldest came in ${formatClock(oldest)}` : "Nothing waiting"} />
      </div>
      {flagged > 0 && (
        <ul className="flex flex-col">
          {handover.cases.map((f) => {
            const c = cases.find((x) => x.id === f.case_id);
            const why = CHOICE[f.choice];
            return (
              <li key={f.case_id} className="flex min-h-[74px] items-center gap-3 border-b border-border-default py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-mono-m text-text-primary">{f.case_id}</span>
                    {c && <span className="truncate text-body-s text-text-secondary">{fraudTypeLabel(c.fraud_type)}</span>}
                  </p>
                  <p className="flex items-center gap-1.5 text-caption text-text-secondary">
                    <span className="icon-tint flex shrink-0 text-text-tertiary">
                      <Icon name={why.icon} size={14} />
                    </span>
                    {why.line(first)}
                  </p>
                </div>
                {c && <SeverityBadge severity={riskTone(c.risk_score)} />}
                <ButtonLink href={`/cases/${f.case_id}`} variant="secondary" size="md" className="w-[104px]" onClick={onDone}>
                  Open
                </ButtonLink>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
