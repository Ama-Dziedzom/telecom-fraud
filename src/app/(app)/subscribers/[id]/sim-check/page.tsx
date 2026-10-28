"use client";

import { Card, CardLink, CardMeta } from "@/components/app/Card";
import { CheckLayout, LinkedNumbers } from "@/components/subscriber/CheckLayout";
import { DetailRows } from "@/components/subscriber/ProfileParts";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useSubscriber } from "@/lib/api/fd";
import { phoneLabel, useSimCheck, type SimCheck } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen, useNow } from "@/lib/time";
import { useParams, useRouter } from "next/navigation";

type Phone = SimCheck["phones"][number];

/** “His usual phone · 14 months” · “Never seen before today” */
function phoneNote(p: Phone, now: number) {
  if (p.usual) return `His usual phone · ${p.used_months} ${p.used_months === 1 ? "month" : "months"}`;
  return formatWhen(p.first_seen_at, now, { withTime: true }).startsWith("Today") ? "Never seen before today" : `First seen ${formatClock(p.first_seen_at)}`;
}

/** One phone the SIM was in: tag, model, place / cell / seen / IMEI, and how well we know it. */
function PhoneCard({ p, now, className }: { p: Phone; now: number; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-2 rounded-lg bg-surface-raised p-4", className)}>
      <span className="text-caption text-text-secondary">{phoneLabel(p.index)}</span>
      <span className="text-label-s text-text-primary">{p.model}</span>
      <div className="w-full">
        <DetailRows
          rows={[
            ["Place", p.place],
            ["Cell", p.cell_id],
            p.usual ? ["Last seen", formatClock(p.last_seen_at)] : ["First seen", formatClock(p.first_seen_at)],
            ["IMEI", p.imei],
          ]}
        />
      </div>
      <Badge label={phoneNote(p, now)} tone={p.usual ? "neutral" : "critical"} />
    </div>
  );
}

const LANE = 44;
const LABELS = 160;

/** Network registrations: one lane per phone on an hour axis, one dot per registration, the overlap shaded. */
function Lanes({ check }: { check: SimCheck }) {
  const from = Date.parse(check.axis.from);
  const to = Date.parse(check.axis.to);
  const x = (t: string | number) => ((typeof t === "number" ? t : Date.parse(t)) - from) / (to - from);
  const pct = (t: string | number) => `${x(t) * 100}%`;
  const hours = Array.from({ length: Math.round((to - from) / 3_600_000) + 1 }, (_, i) => from + i * 3_600_000);
  const step = hours.length > 8 ? 6 : 1;
  const phones = [...check.phones].sort((a, b) => a.index - b.index);
  const gridH = phones.length * LANE;
  return (
    <div className="relative" style={{ height: gridH + (check.overlap ? 58 : 34) }}>
      {phones.map((p, lane) => (
        <span key={p.index} className="absolute left-0 text-body-s whitespace-nowrap text-text-primary" style={{ top: lane * LANE + 12 }}>
          {phoneLabel(p.index)} · {p.place.split(", ").pop()}
        </span>
      ))}
      <div className="absolute top-0 right-0 bottom-0" style={{ left: LABELS }}>
        {check.overlap && (
          <span className="absolute top-0 rounded bg-critical-bg" style={{ left: pct(check.overlap.from), width: `${(x(check.overlap.to) - x(check.overlap.from)) * 100}%`, height: gridH }} />
        )}
        {hours
          .filter((_, i) => i % step === 0)
          .map((h) => (
            <span key={h} className="absolute top-0 w-px bg-border-default" style={{ left: pct(h), height: gridH }}>
              <span className="absolute -translate-x-1/2 text-caption text-text-secondary" style={{ top: gridH + 8 }}>
                {formatClock(h)}
              </span>
            </span>
          ))}
        {phones.map((p, lane) => {
          const regs = check.registrations.filter((r) => r.phone === p.index).map((r) => x(r.at));
          if (!regs.length) return null;
          const top = lane * LANE + 20;
          // The usual phone runs from the start of the axis to its last registration; a new one from its first to now.
          const [a, b] = p.usual ? [0, phones.length > 1 ? Math.max(...regs) : 1] : [Math.min(...regs), 1];
          return (
            <div key={p.index}>
              <span
                className={cn("absolute h-[3px] rounded-[2px]", p.usual ? "bg-border-strong" : "bg-critical-solid")}
                style={{ top: top + 0.5, left: `${a * 100}%`, width: `${(b - a) * 100}%` }}
              />
              {regs.map((r, i) => (
                <span key={i} className="absolute flex -translate-x-1/2" style={{ top: top - 3, left: `${r * 100}%` }}>
                  <Icon name={p.usual ? "app/lane-dot-primary-10" : "app/lane-dot-critical-10"} size={10} className="block" />
                </span>
              ))}
            </div>
          );
        })}
        {check.overlap && (
          <span className="absolute text-caption font-medium whitespace-nowrap text-critical-fg" style={{ top: gridH + 24, left: pct(check.overlap.from) }}>
            Both live {formatClock(check.overlap.from)}-{formatClock(check.overlap.to)}
          </span>
        )}
      </div>
    </div>
  );
}

/** C21/C22 · SIM duplication check */
export default function SimCheckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();
  const { data, isLoading } = useSimCheck(id);
  const { data: sub } = useSubscriber(id);
  const dup = data?.status === "duplicate";
  const phones = [...(data?.phones ?? [])].sort((a, b) => a.index - b.index);
  const [first, second] = phones;
  const openCase = sub?.cases.find((c) => c.status !== "closed");
  const regs = data?.registrations.length ?? 0;
  const town = (p: Phone) => p.place.split(", ").pop();

  return (
    <CheckLayout
      subscriberId={id}
      profileTab="sim"
      section="SIM duplication check"
      title="SIM duplication check"
      status={data ? (dup ? { label: "Duplicate found", tone: "critical" } : { label: "No duplicate", tone: "success" }) : undefined}
      subtitle={data ? `SIM ${data.iccid} · checked against network registrations, last ${data.window_hours} hours` : undefined}
      evidenceTitle="SIM duplication check"
      secondary={
        dup ? (
          // Blocking a SIM is a protective action: it goes through the case.
          <Button variant="danger-outline" size="md" onClick={() => router.push(openCase ? `/cases/${openCase.id}?protect=1` : `/subscribers/${id}`)}>
            Block SIM
          </Button>
        ) : undefined
      }
      loading={isLoading || !data}
    >
      {data && first && (
        <>
          {dup && second ? (
            <Banner tone="error" title="One SIM, two phones, at the same time">
              Live in {town(first)} and {town(second)} {data.minutes_apart} minutes apart, {data.distance_km} km. Nobody travels that fast, so the SIM was cloned or
              re-issued.
            </Banner>
          ) : (
            <Banner tone="success" title="Only one phone used this SIM today">
              All {regs} registrations came from {first.usual ? "his usual " : ""}
              {first.model} around {town(first)}.
            </Banner>
          )}

          <Card title="Where the SIM was">
            <div className="flex items-center gap-4 pb-1">
              <PhoneCard p={first} now={now} className={second ? "flex-1" : "w-[calc(50%-98px)]"} />
              {second && (
                <>
                  <div className="flex w-[180px] shrink-0 flex-col items-center gap-1.5">
                    {data.distance_km !== null && <span className="text-h3 text-text-primary">{data.distance_km} km</span>}
                    {data.minutes_apart !== null && <span className="text-caption text-text-secondary">in {data.minutes_apart} minutes</span>}
                    {dup && <Badge label="Impossible travel" tone="critical" />}
                  </div>
                  <PhoneCard p={second} now={now} className="flex-1" />
                </>
              )}
            </div>
          </Card>

          <Card title="Network registrations today" aside={<CardMeta>{regs} registrations</CardMeta>}>
            <Lanes check={data} />
          </Card>

          {second && data.also_used.length > 0 && (
            <Card title={`${phoneLabel(second.index)} has also used`} aside={<CardLink href={`/network?seed=${id}`}>Show on network</CardLink>}>
              <LinkedNumbers rows={data.also_used} />
            </Card>
          )}
        </>
      )}
    </CheckLayout>
  );
}
