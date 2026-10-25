"use client";

import { AccountFrame } from "@/components/account/AccountFrame";
import { Card, Skeleton } from "@/components/app/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type PersonRef } from "@/lib/api/fd";
import { useState } from "react";

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
  sla_at_risk: { label: "SLA at risk", detail: (e) => `${e.lead_minutes ?? 10} minutes before first-response or close SLA` },
  critical_alert_my_regions: { label: "New critical alert in my regions", detail: () => "Risk 90+ · auto-opened as a case" },
  mention: { label: "Someone mentions me", detail: () => "In a case note or timeline comment" },
  report_finished: { label: "Report ready or failed", detail: () => "Including scheduled reports" },
  connector_problem: { label: "Connector or feed problems", detail: () => "MoMo, HLR, CDR feed delays" },
};
const CATEGORY: Record<string, string> = { cases: "Cases", sla: "SLA", alerts: "Alerts", mentions: "Mentions", reports: "Reports", system: "System" };
const eventLabel = (e: Event) => EVENT[e.id]?.label ?? e.id.replace(/_/g, " ");

/** I9 · Account · notification preferences — what you’re told about, where, and quiet hours. */
export default function NotificationPrefsPage() {
  const toast = useToast();
  const { data } = useApi<Prefs>("/me/notification-preferences");
  const { data: profile } = useApi<{ managed: { supervisor: PersonRef } }>("/me/profile");
  const boss = profile?.managed.supervisor.name.split(" ")[0] ?? "Your supervisor";
  const [edits, setEdits] = useState<Record<string, Partial<Record<Channel, boolean>>>>({});
  const [quiet, setQuiet] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const value = (e: Event, c: Channel) => edits[e.id]?.[c] ?? e[c];
  const quietHours = data?.quiet_hours;

  const save = async () => {
    setBusy(true);
    try {
      // Only the events that changed; locked channels are ignored by the API.
      await apiFetch("PATCH", "/me/notification-preferences", {
        events: Object.entries(edits).map(([id, channels]) => ({ id, ...channels })),
        quiet_hours: { enabled: quiet ?? quietHours?.enabled },
      });
      toast({ tone: "success", title: "Notification preferences saved" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountFrame>
      <Card title="What you’re told about" icon="app/icon-bell-secondary-18">
        {!data ? (
          <Skeleton className="h-[360px] w-full" />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border-subtle">
              <table className="w-full text-left">
                <thead className="border-b border-border-subtle bg-surface-raised">
                  <tr className="text-overline text-text-tertiary uppercase">
                    <th className="py-[11px] pl-5 font-bold">Event</th>
                    <th className="w-[130px] py-[11px] font-bold">Type</th>
                    {["In-app", "Email", "Push"].map((h) => (
                      <th key={h} className="w-[110px] py-[11px] font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e.id} className="border-b border-border-subtle last:border-b-0">
                      <td className="py-3 pl-5">
                        <p className="text-body-m font-medium text-text-primary">{eventLabel(e)}</p>
                        <p className="text-caption text-text-secondary">{EVENT[e.id]?.detail(e, boss)}</p>
                      </td>
                      <td className="py-3 text-body-s text-text-secondary">{CATEGORY[e.category] ?? e.category}</td>
                      {(["in_app", "email", "push"] as const).map((c) => {
                        const v = value(e, c);
                        return (
                          <td key={c} className="py-3">
                            {e.locked.includes(c) ? (
                              <span title="Required for your role" className="flex size-[18px] items-center justify-center rounded-[5px] bg-surface-sunken">
                                <Icon name="icon-lock-secondary-16" size={12} />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                aria-label={`${eventLabel(e)}: ${c.replace("_", "-")}`}
                                checked={v}
                                onChange={(ev) => setEdits((x) => ({ ...x, [e.id]: { ...x[e.id], [c]: ev.target.checked } }))}
                                className="size-[18px] cursor-pointer accent-brand-primary"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="flex items-center gap-1.5 text-caption text-text-tertiary">
              <Icon name="icon-lock-secondary-16" size={12} />
              Locked in-app: required for your role by Kasa Mobile.
            </p>
          </>
        )}
      </Card>
      <Card title="Quiet hours" icon="app/icon-clock-secondary-18">
        <div className="flex items-center justify-between gap-4">
          <Toggle label="Mute email and push outside my shift" checked={quiet ?? quietHours?.enabled ?? true} onChange={(e) => setQuiet(e.target.checked)} />
          {quietHours && (
            <span className="text-caption text-text-secondary">
              Off shift: {quietHours.from}-{quietHours.to}
              {quietHours.critical_sla_still_notify && " · critical SLA warnings still come through"}
            </span>
          )}
        </div>
      </Card>
      <div className="flex justify-end gap-3">
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            setEdits({});
            setQuiet(null);
          }}
        >
          Reset to defaults
        </Button>
        <Button size="md" onClick={save} loading={busy}>
          Save changes
        </Button>
      </div>
    </AccountFrame>
  );
}
