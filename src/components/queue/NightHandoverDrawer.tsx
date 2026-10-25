"use client";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer, KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { fraudTypeLabel, type Alert, type CaseSummary } from "@/lib/api/fd";
import type { HandoverChoice, ShiftHandover } from "@/lib/api/local";
import { formatClockOrDay, formatSpan } from "@/lib/time";

const CHOICE: Record<HandoverChoice, (from: string) => string> = {
  hand_over: () => "Handed to you",
  watch: () => "Asked you to watch it",
  keep: (from) => `${from} is keeping it`,
};

/** Start and end of the shift the handover covers (operators work in Ghana time, which is UTC). */
function shiftWindow(h: ShiftHandover) {
  const day = h.at.slice(0, 10);
  const end = Date.parse(`${day}T${h.shift.ends}:00Z`);
  const start = Date.parse(`${day}T${h.shift.starts}:00Z`);
  return { start: start < end ? start : start - 86_400_000, end };
}

/** A7 · Start of shift · read the night handover */
export function NightHandoverDrawer({
  open,
  handover,
  cases,
  alerts,
  myShift,
  now,
  onDone,
}: {
  open: boolean;
  handover: ShiftHandover;
  /** My open cases, for the titles of the flagged ones and what breached overnight. */
  cases: CaseSummary[];
  /** Open alerts. */
  alerts: Alert[];
  myShift: string;
  now: number;
  onDone: () => void;
}) {
  const first = handover.from.name.split(" ")[0];
  const shift = handover.shift.name[0].toUpperCase() + handover.shift.name.slice(1);
  const handed = handover.cases.filter((c) => c.choice === "hand_over").length;
  const { start, end } = shiftWindow(handover);
  const breached = cases.filter((c) => {
    const due = Date.parse(c.sla_due_at);
    return due >= start && due <= end;
  });
  const untriaged = alerts.filter((a) => a.status === "new");
  const oldest = Math.min(...untriaged.map((a) => Date.parse(a.created_at)));

  return (
    <Drawer
      open={open}
      onClose={onDone}
      badges={<Badge label={`${shift} handover`} tone="info" />}
      title={`From ${handover.from.name} · ${formatClockOrDay(handover.at, now)}`}
      subtitle={`${shift} shift ${handover.shift.starts}-${handover.shift.ends} · ${
        handed
          ? `${handed} ${handed === 1 ? "case" : "cases"} handed to the ${myShift} shift`
          : `${handover.cases.length} ${handover.cases.length === 1 ? "case" : "cases"} flagged for the ${myShift} shift`
      }`}
      footer={
        <>
          {/* TODO(api): no messaging endpoint yet, so this can’t send anything. */}
          <Button
            variant="secondary"
            size="md"
            disabled
            title="Messaging colleagues isn’t available yet"
            iconLeft={<Icon name="app/icon-message-18" size={18} />}
          >
            Ask {first} a question
          </Button>
          <span className="flex-1" />
          <Button size="md" onClick={onDone} iconLeft={<Icon name="app/icon-check-white-18" size={18} />}>
            Got it: start my shift
          </Button>
        </>
      }
    >
      <p className="rounded-[10px] bg-surface-raised px-3.5 py-3 text-body-m text-text-primary">{handover.note}</p>
      {handover.cases.length > 0 && (
        <>
          <p className="text-overline text-text-tertiary uppercase">Flagged for you</p>
          <ul className="flex flex-col">
            {handover.cases.map((f) => {
              const c = cases.find((x) => x.id === f.case_id);
              return (
                <li key={f.case_id} className="flex items-center gap-3 border-b border-border-subtle py-2.5">
                  <span className="font-mono text-mono-m text-text-brand">{f.case_id}</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-body-m text-text-primary">
                      {c ? `${fraudTypeLabel(c.fraud_type)} · ${c.subscriber.name}` : "Case"}
                    </span>
                    <span className="truncate text-caption text-text-secondary">{CHOICE[f.choice](first)}</span>
                  </span>
                  <span className="flex-1" />
                  <ButtonLink href={`/cases/${f.case_id}`} variant="ghost" size="sm" onClick={onDone}>
                    Open
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <KeyValueList
        rows={[
          ["Breached overnight", breached.length ? breached.map((c) => c.id).join(", ") : "None"],
          [
            "Alerts waiting",
            untriaged.length ? `${untriaged.length} untriaged · oldest ${formatSpan(now - oldest)}` : "None",
          ],
        ]}
      />
    </Drawer>
  );
}
