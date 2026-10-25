"use client";

import { Card } from "@/components/app/Card";
import { CheckLayout } from "@/components/subscriber/CheckLayout";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useBehaviour, useSubscriber360 } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/time";
import { useParams, useRouter } from "next/navigation";

const SIGNAL_ICON: Record<string, string> = {
  where: "app/icon-map-pin-secondary-16",
  device: "app/icon-laptop-secondary-16",
  hours: "app/icon-clock-secondary-16",
  average: "app/icon-wallet-secondary-16",
  recipients: "app/icon-users-secondary-16",
};

/** C19/C20 · Behaviour profile — normal vs now */
export default function BehaviourPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: sub } = useSubscriber360(id);
  const { data, isLoading } = useBehaviour(id);
  const unusual = data?.signals.filter((s) => s.unusual).length ?? 0;
  const openCase = sub?.cases.find((c) => c.status !== "closed");
  const max = Math.max(...(data?.daily.map((d) => d.amount.amount_minor) ?? [1]));
  // Bars are scaled to GHS 600 so the normal band is readable; today breaks out of the frame.
  const scale = 60_000;
  const todayX = data ? data.daily[data.daily.length - 1].amount.amount_minor / (data.normal_max.amount_minor || 1) : 0;

  return (
    <CheckLayout
      subscriberId={id}
      section="Behaviour profile"
      title="Normal vs now"
      status={data ? { label: `${unusual} of ${data.signals.length} signals unusual`, tone: unusual ? "critical" : "success" } : undefined}
      subtitle={sub && data ? `${sub.name} · ${sub.msisdn} · compared with his last ${data.compared_days} days` : undefined}
      evidenceTitle="Behaviour profile: normal vs now"
      loading={isLoading || !data}
    >
      {data && (
        <>
          <div className="flex gap-3">
            {data.signals.map((s) => (
              <div key={s.key} className={cn("flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl border bg-surface-base px-[18px] py-4", s.unusual ? "border-critical-border" : "border-border-subtle")}>
                <span className="flex items-center gap-2 text-label-s text-text-secondary">
                  <Icon name={SIGNAL_ICON[s.key] ?? "app/icon-activity-secondary-18"} size={16} />
                  {s.label}
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-overline text-text-tertiary uppercase">Usual</span>
                    <span className="truncate text-label-m text-text-primary">{s.usual}</span>
                  </span>
                  <Icon name="app/icon-arrow-right-tertiary-16" size={16} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-overline text-text-tertiary uppercase">Today</span>
                    <span className={cn("truncate text-label-m", s.unusual ? "text-critical-fg" : "text-text-primary")}>{s.today}</span>
                  </span>
                </span>
                <Badge label={s.unusual ? "Unusual" : "Normal"} tone={s.unusual ? "critical" : "success"} dot />
              </div>
            ))}
          </div>

          <Card
            title="Money out per day · last 30 days"
            icon="app/icon-chart-secondary-18"
            aside={<Badge label={`Today is ${Math.round(todayX)}× his normal`} tone="critical" />}
          >
            <div className="relative h-[150px] pl-14">
              {[0, 300, 600].map((v) => (
                <span key={v} className="absolute left-0 font-mono text-mono-s text-text-tertiary" style={{ bottom: `calc(${((v * 100) / scale) * 100}% - 9px)` }}>
                  GHS {v}
                </span>
              ))}
              <span
                className="absolute right-0 left-14 bg-success-bg"
                style={{ bottom: 0, height: `${(data.normal_max.amount_minor / scale) * 100}%` }}
              >
                <span className="absolute top-1 left-1.5 text-caption font-medium text-success-fg">
                  His normal: up to {formatMoney(data.normal_max.amount_minor, data.normal_max.currency)} a day
                </span>
              </span>
              <div className="relative flex h-full items-end gap-1">
                {data.daily.map((d, i) => {
                  const today = i === data.daily.length - 1;
                  return (
                    <span
                      key={d.date}
                      title={`${d.date}: ${formatMoney(d.amount.amount_minor, d.amount.currency)}`}
                      className={cn("relative min-w-0 flex-1 rounded-t-[3px]", today ? "bg-critical-fg" : "bg-brand-highlight/60")}
                      style={{ height: today ? "100%" : `${Math.min(100, (d.amount.amount_minor / scale) * 100)}%` }}
                    >
                      {today && (
                        <span className="absolute -top-6 right-0 text-caption font-medium whitespace-nowrap text-critical-fg">
                          {formatMoney(max, d.amount.currency)}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="flex gap-4">
            <Card title="When he uses MoMo" icon="app/icon-clock-secondary-18" className="min-w-0 flex-1">
              <div className="flex gap-1">
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    title={`${String(h).padStart(2, "0")}:00`}
                    className={cn(
                      "h-5 flex-1 rounded-[3px]",
                      data.hours.today.includes(h) ? "bg-critical-fg" : data.hours.usual.includes(h) ? "bg-brand-highlight/60" : "bg-surface-sunken",
                    )}
                  />
                ))}
              </div>
              <div className="flex justify-between font-mono text-mono-s text-text-tertiary">
                {["00", "03", "06", "09", "12", "15", "18", "21"].map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              <div className="flex gap-4 text-caption text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-brand-highlight/60" /> Usual hours
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-critical-fg" /> Activity today
                </span>
              </div>
            </Card>
            <Card title="Where he uses MoMo" icon="app/icon-map-pin-secondary-18" className="min-w-0 flex-1">
              <ul className="flex flex-col gap-3">
                {data.places.map((p) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className="w-[150px] text-body-s text-text-primary">{p.name}</span>
                    <span className="h-1.5 flex-1 rounded-full bg-surface-sunken">
                      <span className={cn("block h-1.5 rounded-full", p.today ? "bg-critical-fg" : "bg-brand-highlight")} style={{ width: `${p.share}%` }} />
                    </span>
                    <span className={cn("w-10 text-right font-mono text-mono-s", p.today ? "text-critical-fg" : "text-text-secondary")}>{p.share}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {data.verdict && (
            <section className="flex items-center gap-4 rounded-xl border border-critical-border bg-critical-bg px-5 py-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-surface-base">
                <Icon name="app/icon-zap-critical-22" size={22} />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-h3 text-critical-fg">{data.verdict.title}</p>
                <p className="text-body-m text-text-secondary">{data.verdict.detail}</p>
              </div>
              <span className="flex-1" />
              {openCase && (
                <>
                  <ButtonLink href={`/cases/${openCase.id}`} variant="secondary" size="md">
                    Open case {openCase.id}
                  </ButtonLink>
                  <Button variant="danger" size="md" onClick={() => router.push(`/cases/${openCase.id}?protect=1`)} iconLeft={<Icon name="app/icon-shield-white-18" size={18} />}>
                    Protect now
                  </Button>
                </>
              )}
            </section>
          )}
        </>
      )}
    </CheckLayout>
  );
}
