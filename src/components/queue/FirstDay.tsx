"use client";

import { Card } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { markSetupDone, SETUP_KEY, useStored, type SetupStep } from "@/lib/api/local";

const HOW_IT_WORKS = [
  { icon: "app/icon-alert-triangle-critical-22", title: "1 · Alerts come in", body: "The rules engine flags risky activity in seconds. Critical ones become cases automatically." },
  { icon: "app/icon-inbox-brand-22", title: "2 · You triage", body: "Dismiss false alarms, open a case, or add to one that exists." },
  { icon: "app/icon-shield-check-success-22", title: "3 · You resolve", body: "Investigate, protect the subscriber, and close with an outcome." },
];

const STEPS: Array<{ id: SetupStep; icon: string; title: string; body: string; action: string; href: string }> = [
  { id: "alerts", icon: "app/icon-bell-brand-18", title: "Choose how you get alerted", body: "Critical alerts by in-app sound and email · 1 min", action: "Start", href: "/account/notifications" },
  { id: "tour", icon: "app/icon-activity-brand-18", title: "Take the 2-minute tour", body: "How triage, cases and protective actions fit together", action: "Start", href: "#tour" },
  { id: "first_alert", icon: "app/icon-inbox-brand-18", title: "Triage your first alert", body: "Pick one from Live alerts: it becomes your first case", action: "Open live alerts", href: "/alerts" },
];

/** A3 · First day · empty queue — how it works + the “Get set up” checklist. */
export function FirstDay() {
  const done = useStored<SetupStep[]>(SETUP_KEY) ?? [];
  const total = STEPS.length + 1; // account setup is always done by now

  return (
    <>
      <Card title="Your queue is empty" icon="app/icon-inbox-secondary-18">
        <p className="text-body-m text-text-secondary">
          Nothing is assigned to you yet. Cases land here when you pick up an alert or a supervisor assigns you one.
        </p>
        <div className="flex gap-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.title} className="flex flex-1 flex-col gap-2 rounded-xl border border-border-subtle px-5 py-[18px]">
              <Icon name={s.icon} size={22} />
              <p className="text-label-m text-text-primary">{s.title}</p>
              <p className="text-body-s text-text-secondary">{s.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Get set up"
        icon="app/icon-check-circle-secondary-18"
        aside={<span className="text-caption font-medium text-text-secondary">{done.length + 1} of {total} done</span>}
      >
        <ul className="flex flex-col">
          <li className="flex items-center gap-3.5 border-b border-border-subtle py-3.5">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-success-bg">
              <Icon name="app/icon-check-circle-success-18" size={18} />
            </span>
            <span className="flex flex-col gap-0.5 text-text-secondary">
              <span className="text-label-m">Account and two-step verification set up</span>
              <span className="text-body-s">Done during sign-in</span>
            </span>
            <span className="flex-1" />
            <Badge label="Done" tone="success" />
          </li>
          {STEPS.map((s) => {
            const isDone = done.includes(s.id);
            return (
              <li key={s.id} className="flex items-center gap-3.5 border-b border-border-subtle py-3.5 last:border-b-0">
                <span className={`flex size-9 items-center justify-center rounded-[10px] ${isDone ? "bg-success-bg" : "bg-brand-primary-subtle"}`}>
                  <Icon name={isDone ? "app/icon-check-circle-success-18" : s.icon} size={18} />
                </span>
                <span className={`flex flex-col gap-0.5 ${isDone ? "text-text-secondary" : ""}`}>
                  <span className={`text-label-m ${isDone ? "" : "text-text-primary"}`}>{s.title}</span>
                  <span className="text-body-s text-text-secondary">{s.body}</span>
                </span>
                <span className="flex-1" />
                {isDone ? (
                  <Badge label="Done" tone="success" />
                ) : (
                  <ButtonLink
                    href={s.href}
                    variant="secondary"
                    size="sm"
                    onClick={() => markSetupDone(s.id, done)}
                  >
                    {s.action}
                  </ButtonLink>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
