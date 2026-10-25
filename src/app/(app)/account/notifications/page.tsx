"use client";

import { AccountFrame } from "@/components/account/AccountFrame";
import { Card, Skeleton } from "@/components/app/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { useState } from "react";

type Channel = "in_app" | "email" | "push";
type Event = { id: string; label: string; detail: string; type: string } & Record<Channel, boolean | "locked">;
type Prefs = { events: Event[]; quiet_hours: { enabled: boolean; label: string } };

/** I9 · Account · notification preferences — what you’re told about, where, and quiet hours. */
export default function NotificationPrefsPage() {
  const toast = useToast();
  // TODO(api): proposed GET/PATCH /me/notification-preferences.
  const { data } = useApi<Prefs>("/me/notification-preferences");
  const [edits, setEdits] = useState<Record<string, Partial<Record<Channel, boolean>>>>({});
  const [quiet, setQuiet] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const value = (e: Event, c: Channel) => edits[e.id]?.[c] ?? e[c];

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch("PATCH", "/me/notification-preferences", {
        events: data?.events.map((e) => ({ id: e.id, in_app: value(e, "in_app") !== false, email: value(e, "email") === true, push: value(e, "push") === true })),
        quiet_hours: { enabled: quiet ?? data?.quiet_hours.enabled },
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
                        <p className="text-body-m font-medium text-text-primary">{e.label}</p>
                        <p className="text-caption text-text-secondary">{e.detail}</p>
                      </td>
                      <td className="py-3 text-body-s text-text-secondary">{e.type}</td>
                      {(["in_app", "email", "push"] as const).map((c) => {
                        const v = value(e, c);
                        return (
                          <td key={c} className="py-3">
                            {v === "locked" ? (
                              <span title="Required for your role" className="flex size-[18px] items-center justify-center rounded-[5px] bg-surface-sunken">
                                <Icon name="icon-lock-secondary-16" size={12} />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                aria-label={`${e.label}: ${c.replace("_", "-")}`}
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
          <Toggle label="Mute email and push outside my shift" checked={quiet ?? data?.quiet_hours.enabled ?? true} onChange={(e) => setQuiet(e.target.checked)} />
          <span className="text-caption text-text-secondary">{data?.quiet_hours.label}</span>
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
