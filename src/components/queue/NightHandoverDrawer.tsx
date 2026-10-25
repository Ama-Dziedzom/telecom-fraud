"use client";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer, KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import type { NightHandover } from "@/lib/api/local";
import { formatClockOrDay } from "@/lib/time";

/** A7 · Start of shift · read the night handover */
export function NightHandoverDrawer({
  open,
  handover,
  now,
  onDone,
}: {
  open: boolean;
  handover: NightHandover;
  now: number;
  onDone: () => void;
}) {
  const first = handover.author.name.split(" ")[0];
  return (
    <Drawer
      open={open}
      onClose={onDone}
      badges={<Badge label="Night handover" tone="info" />}
      title={`From ${handover.author.name} · ${formatClockOrDay(handover.at, now)}`}
      subtitle={`Night shift ${handover.shiftHours} · ${handover.handedCount} cases handed to the day shift`}
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
      <p className="text-overline text-text-tertiary uppercase">Flagged for you</p>
      <ul className="flex flex-col">
        {handover.flagged.map((f) => (
          <li key={f.ref} className="flex items-center gap-3 border-b border-border-subtle py-2.5">
            <span className="font-mono text-mono-m text-text-brand">{f.ref}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body-m text-text-primary">{f.title}</span>
              <span className="truncate text-caption text-text-secondary">{f.detail}</span>
            </span>
            <span className="flex-1" />
            <ButtonLink href={f.href} variant="ghost" size="sm" onClick={onDone}>
              Open
            </ButtonLink>
          </li>
        ))}
      </ul>
      <KeyValueList
        rows={[
          ["Breached overnight", handover.breachedOvernight],
          ["Alerts waiting", handover.alertsWaiting],
        ]}
      />
    </Drawer>
  );
}
