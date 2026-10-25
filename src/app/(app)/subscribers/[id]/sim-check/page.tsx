"use client";

import { Card } from "@/components/app/Card";
import { CheckLayout, LinkedNumbers, Verdict } from "@/components/subscriber/CheckLayout";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useSimCheck, type SimCheck } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/time";
import { useParams, useRouter } from "next/navigation";

function Phone({ p }: { p: SimCheck["phones"][number] }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-3 rounded-xl border bg-surface-base px-5 py-[18px]", p.usual ? "border-border-subtle" : "border-critical-border")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-10 items-center justify-center rounded-[10px]", p.usual ? "bg-neutral-bg" : "bg-critical-bg")}>
          <Icon name={p.usual ? "app/icon-phone-neutral-20" : "app/icon-phone-critical-20"} size={20} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-overline text-text-tertiary uppercase">{p.label}</span>
          <span className="text-title text-text-primary">{p.model}</span>
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        <li className="flex items-center gap-2 text-label-m text-text-primary">
          <Icon name="app/icon-map-pin-tertiary-16" size={16} />
          {p.place}
        </li>
        {[
          ["app/icon-wifi-off-tertiary-16", p.cell && `Cell ${p.cell}`],
          ["app/icon-clock-tertiary-16", p.seen],
          ["app/icon-fingerprint-tertiary-16", p.imei && `IMEI ${p.imei}`],
        ].map(([icon, text]) =>
          text ? (
            <li key={icon} className="flex items-center gap-2 font-mono text-mono-s text-text-secondary">
              <Icon name={icon as string} size={16} />
              {text}
            </li>
          ) : null,
        )}
      </ul>
      {p.note && <Badge label={p.note} tone={p.usual ? "neutral" : "critical"} dot />}
    </div>
  );
}

/** Two lanes on a time axis, one dot per network registration. */
function Lanes({ check }: { check: SimCheck }) {
  const from = Date.parse(check.axis.from);
  const to = Date.parse(check.axis.to);
  const x = (iso: string) => ((Date.parse(iso) - from) / (to - from)) * 100;
  const hours = Array.from({ length: Math.round((to - from) / 3_600_000) + 1 }, (_, i) => from + i * 3_600_000);
  const step = hours.length > 8 ? 6 : 1;
  return (
    <div className="relative h-[150px] pl-[140px]">
      <div className="relative h-full">
        {hours
          .filter((_, i) => i % step === 0)
          .map((h) => (
            <span key={h} className="absolute top-0 h-[112px] w-px bg-border-subtle" style={{ left: `${((h - from) / (to - from)) * 100}%` }}>
              <span className="absolute top-[120px] -translate-x-1/2 font-mono text-mono-s text-text-tertiary">{formatClock(h)}</span>
            </span>
          ))}
        {check.overlap && (
          <span
            className="absolute top-0 h-[112px] bg-critical-bg"
            style={{ left: `${x(check.overlap.from)}%`, width: `${x(check.overlap.to) - x(check.overlap.from)}%` }}
          >
            <span className="absolute top-24 left-1.5 text-caption font-medium whitespace-nowrap text-critical-fg">
              Both live {formatClock(check.overlap.from)}-{formatClock(check.overlap.to)}
            </span>
          </span>
        )}
        {check.phones.map((p, lane) => {
          const regs = check.registrations.filter((r) => r.phone === lane);
          if (!regs.length) return null;
          const first = Math.min(...regs.map((r) => x(r.at)));
          const last = Math.max(...regs.map((r) => x(r.at)));
          const top = 24 + lane * 52;
          const color = p.usual ? "bg-brand-highlight" : "bg-critical-border";
          const dot = p.usual ? "border-brand-primary bg-brand-primary" : "border-critical-fg bg-critical-fg";
          return (
            <div key={lane}>
              <span className="absolute -left-[140px] text-label-s text-text-secondary" style={{ top: top - 2 }}>
                {p.label} · {p.place.split(", ").pop()}
              </span>
              <span className={cn("absolute h-2.5 rounded-[5px]", color)} style={{ top, left: `${first}%`, width: `${Math.max(1, (lane === 0 ? last : 100) - first)}%` }} />
              {regs.map((r) => (
                <span
                  key={r.at}
                  title={formatClock(r.at)}
                  className={cn("absolute size-3 -translate-x-1/2 rounded-full border-2", dot)}
                  style={{ top: top - 1, left: `${x(r.at)}%` }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** C21/C22 · SIM duplication check */
export default function SimCheckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useSimCheck(id);
  const dup = data?.status === "duplicate";

  return (
    <CheckLayout
      subscriberId={id}
      section="SIM duplication check"
      title="SIM duplication check"
      status={data ? (dup ? { label: "Duplicate detected", tone: "critical" } : { label: "No duplicate", tone: "success" }) : undefined}
      subtitle={data ? `SIM ${data.sim} · checked against network registrations for the last ${data.window_hours} hours` : undefined}
      evidenceTitle="SIM duplication check"
      loading={isLoading || !data}
    >
      {data &&
        (dup ? (
          <>
            <Verdict
              tone="critical"
              icon="app/icon-sim-critical-22"
              title="One SIM, two phones, at the same time"
              actions={
                // TODO(api): blocking a SIM is a protective action; it goes through the case.
                <Button variant="danger" size="md" onClick={() => router.push(`/subscribers/${id}`)} iconLeft={<Icon name="app/icon-ban-white-18" size={18} />}>
                  Block this SIM
                </Button>
              }
            >
              The SIM was live in {data.phones[0].place.split(", ").pop()} and {data.phones[1].place.split(", ").pop()} {data.minutes_apart} minutes apart. Nobody travels{" "}
              {data.distance_km} km that fast, so the SIM has been cloned or re-issued.
            </Verdict>
            <Card title="Where the SIM was" icon="app/icon-map-pin-secondary-18">
              <div className="flex items-center gap-4">
                <Phone p={data.phones[0]} />
                <div className="flex flex-col items-center gap-1.5 px-2">
                  <span className="text-h2 text-critical-fg">{data.distance_km} km</span>
                  <span className="h-0.5 w-40 bg-critical-border" />
                  <span className="text-label-s text-critical-fg">in {data.minutes_apart} minutes</span>
                  <Badge label="Impossible travel" tone="critical" />
                </div>
                <Phone p={data.phones[1]} />
              </div>
            </Card>
            <Card title="Network registrations today" icon="app/icon-activity-secondary-18" aside={<Badge label={`${data.registrations.length} registrations`} tone="neutral" />}>
              <Lanes check={data} />
            </Card>
            {data.also_used && (
              <Card
                title="Phone B has also used"
                icon="app/icon-sim-18"
                aside={
                  <ButtonLink href={`/network?seed=${id}`} variant="ghost" size="sm" iconLeft={<Icon name="app/icon-network-brand-16" size={16} />}>
                    Show on network
                  </ButtonLink>
                }
              >
                <LinkedNumbers sims rows={data.also_used} />
              </Card>
            )}
          </>
        ) : (
          <>
            <Verdict
              tone="success"
              icon="app/icon-shield-check-success-22"
              title="One SIM, one phone"
              actions={
                <ButtonLink href={`/subscribers/${id}`} variant="secondary" size="md" iconLeft={<Icon name="app/icon-arrow-left-18" size={18} />}>
                  Back to Subscriber 360
                </ButtonLink>
              }
            >
              Every registration in the last {data.window_hours} hours came from the same phone, in places she normally goes. Nothing to act on here.
            </Verdict>
            <Card
              title="Network registrations · last 24 hours"
              icon="app/icon-activity-secondary-18"
              aside={<Badge label={`${data.registrations.length} registrations · 1 phone`} tone="neutral" />}
            >
              <Lanes check={data} />
            </Card>
            <Card title="What we checked" icon="app/icon-check-circle-secondary-18">
              <ul className="flex flex-col gap-2">
                {data.checked?.map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2 text-body-s">
                    <span className="text-text-secondary">{k}</span>
                    <span className="text-label-m text-text-primary">{v}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        ))}
    </CheckLayout>
  );
}
