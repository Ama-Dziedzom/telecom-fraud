"use client";

import { AccountFrame, SettingRow } from "@/components/account/AccountFrame";
import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type PersonRef } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { Fragment, useState } from "react";

type Channel = "in_app" | "email" | "push";
type Event = { id: string; category: string; locked: Channel[]; lead_minutes?: number } & Record<Channel, boolean>;
type Prefs = {
  events: Event[];
  quiet_hours: { enabled: boolean; from: string; to: string; critical_sla_still_notify: boolean };
};

/** The app’s wording for each event. `boss` is the supervisor’s first name. */
const EVENT: Record<string, { label: string; detail: (e: Event, boss: string) => string }> = {
  case_assigned: { label: "Case assigned to me", detail: () => "When an alert is promoted or a colleague hands one over" },
  case_sent_back: { label: "Supervisor sent a case back", detail: () => "Needs changes before sign-off" },
  sign_off_decision: { label: "Sign-off decision", detail: (_, boss) => `${boss} approved or rejected your resolution` },
  sla_at_risk: { label: "SLA at risk", detail: (e) => `${e.lead_minutes ?? 10} minutes before first response or close is due` },
  critical_alert_my_regions: { label: "New critical alert in my regions", detail: () => "Risk 90+, opened as a case automatically" },
  mention: { label: "Someone mentions me", detail: () => "In a case note or timeline comment" },
  report_finished: { label: "Report ready or failed", detail: () => "Including scheduled reports" },
  connector_problem: { label: "Connector or feed problems", detail: () => "MoMo, HLR and CDR feed delays" },
};
/** Event categories, grouped the way the analyst thinks about them. */
const GROUP: Record<string, string> = { cases: "Cases", sla: "SLA and alerts", alerts: "SLA and alerts", mentions: "Mentions and reports", reports: "Mentions and reports", system: "System" };
const CHANNELS: Array<[Channel, string]> = [
  ["in_app", "In-app"],
  ["email", "Email"],
  ["push", "Push"],
];
const eventLabel = (e: Event) => EVENT[e.id]?.label ?? e.id.replace(/_/g, " ");

/** I9 · Account · notification preferences — what you’re told about, where, and quiet hours. Saves as you go. */
export default function NotificationPrefsPage() {
  const toast = useToast();
  const operator = useOperatorName() ?? "MTN Ghana";
  const { data } = useApi<Prefs>("/me/notification-preferences");
  const { data: profile } = useApi<{ managed: { supervisor: PersonRef } }>("/me/profile");
  const boss = profile?.managed.supervisor.name.split(" ")[0] ?? "Your supervisor";
  const [edits, setEdits] = useState<Record<string, Partial<Record<Channel, boolean>>>>({});
  const [quiet, setQuiet] = useState<boolean | null>(null);
  const value = (e: Event, c: Channel) => edits[e.id]?.[c] ?? e[c];
  const quietHours = data?.quiet_hours;

  /** PATCH one change; undo it on screen if the server says no. */
  const save = async (body: object, done: string, undo: () => void) => {
    try {
      await apiFetch("PATCH", "/me/notification-preferences", body);
      toast({ tone: "success", title: "Saved", body: done });
    } catch {
      undo();
      toast({ title: "Couldn’t save that change", body: "Check your connection and try again." });
    }
  };

  const setChannel = (e: Event, c: Channel, on: boolean) => {
    const before = value(e, c);
    setEdits((x) => ({ ...x, [e.id]: { ...x[e.id], [c]: on } }));
    const name = CHANNELS.find(([id]) => id === c)![1];
    void save({ events: [{ id: e.id, [c]: on }] }, `${name} for “${eventLabel(e)}” is now ${on ? "on" : "off"}.`, () =>
      setEdits((x) => ({ ...x, [e.id]: { ...x[e.id], [c]: before } })),
    );
  };

  const setQuietHours = (on: boolean) => {
    const before = quiet;
    setQuiet(on);
    void save({ quiet_hours: { enabled: on } }, on ? "Email and push are muted outside your shift." : "Quiet hours are off.", () => setQuiet(before));
  };

  return (
    <AccountFrame>
      <Card title="What you’re told about" aside={<CardMeta>Changes save as you go</CardMeta>}>
        {!data ? (
          <Skeleton className="h-[360px] w-full" />
        ) : (
          <div className="flex flex-col">
            <div className="flex justify-end pb-1" aria-hidden>
              {CHANNELS.map(([c, label]) => (
                <span key={c} className="w-[66px] text-center text-caption text-text-secondary">
                  {label}
                </span>
              ))}
            </div>
            {data.events.map((e, i) => {
              const groupOf = (x: Event) => GROUP[x.category] ?? x.category;
              const group = groupOf(e);
              const header = i === 0 || groupOf(data.events[i - 1]) !== group;
              return (
                <Fragment key={e.id}>
                  {header && <p className="border-b border-border-default pt-4 pb-2 text-caption text-text-secondary">{group}</p>}
                  <SettingRow title={eventLabel(e)} detail={EVENT[e.id]?.detail(e, boss)}>
                    <span className="flex">
                      {CHANNELS.map(([c, label]) => {
                        const locked = e.locked.includes(c);
                        return (
                          <span key={c} className="flex w-[66px] justify-center">
                            <Toggle
                              label={<span className="sr-only">{`${eventLabel(e)}: ${label}${locked ? " (required for your role)" : ""}`}</span>}
                              checked={locked || value(e, c)}
                              disabled={locked}
                              onChange={(ev) => setChannel(e, c, ev.target.checked)}
                              className={cn("gap-0", locked && "cursor-not-allowed opacity-40")}
                            />
                          </span>
                        );
                      })}
                    </span>
                  </SettingRow>
                </Fragment>
              );
            })}
            <p className="pt-4 text-caption text-text-secondary">Faded switches are on and required for your role by {operator}.</p>
          </div>
        )}
      </Card>
      <Card title="Quiet hours">
        <SettingRow
          title="Mute email and push outside my shift"
          detail={
            quietHours &&
            `Off shift ${quietHours.from}-${quietHours.to}${quietHours.critical_sla_still_notify ? " · critical SLA warnings still come through" : ""}`
          }
        >
          <Toggle
            label={<span className="sr-only">Mute email and push outside my shift</span>}
            checked={quiet ?? quietHours?.enabled ?? true}
            disabled={!quietHours}
            onChange={(e) => setQuietHours(e.target.checked)}
            className="gap-0"
          />
        </SettingRow>
      </Card>
    </AccountFrame>
  );
}
