"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { CheckLayout, LinkedNumbers } from "@/components/subscriber/CheckLayout";
import { PartyRow } from "@/components/subscriber/ProfileParts";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useSubscriber } from "@/lib/api/fd";
import { phoneLabel, useDeviceCheck, type DeviceCheck } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen, TZ, useNow } from "@/lib/time";
import { useParams, useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

/** Full IMEIs are grouped TAC · serial · check digit; masked ones (“3569…4417”) are shown as sent. */
const spaced = (imei: string) => (/^\d{15}$/.test(imei) ? `${imei.slice(0, 2)} ${imei.slice(2, 8)} ${imei.slice(8, 14)} ${imei.slice(14)}` : imei);

/** The 15 digits; masked digits show as dots so the check digit stays last. */
function digitsOf(imei: string) {
  const [head, tail = ""] = imei.replace(/\s/g, "").split(/…|\*+/);
  if (!tail) return head.split("");
  return [...head.split(""), ...Array.from({ length: Math.max(0, 15 - head.length - tail.length) }, () => "•"), ...tail.split("")];
}

/** “IMEI from Phone B · first seen on this SIM today 08:39” */
function source(d: DeviceCheck, now: number) {
  const from = d.from_phone !== null ? `IMEI from ${phoneLabel(d.from_phone)}` : "IMEI from the phone";
  const when = formatWhen(d.first_seen_on_sim_at, now, { withTime: true });
  return when.startsWith("Today")
    ? `${from} · first seen on this SIM today ${formatClock(d.first_seen_on_sim_at)}`
    : `${from} · on this SIM since ${new Date(d.first_seen_on_sim_at).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: TZ })}`;
}

/** One group of digit boxes with its underline and caption. */
function DigitGroup({ digits, caption, tone = "neutral" }: { digits: string[]; caption: string; tone?: "neutral" | "critical" }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        {digits.map((d, i) => (
          <span
            key={i}
            className={cn(
              "flex h-12 w-10 items-center justify-center rounded-md font-mono text-[18px] font-medium",
              tone === "critical" ? "border-[1.5px] border-critical-solid bg-critical-bg text-critical-fg" : "border border-border-default bg-surface-raised text-text-primary",
            )}
          >
            {d}
          </span>
        ))}
      </div>
      <span className={cn("h-0.5 w-full", tone === "critical" ? "bg-critical-solid" : "bg-border-strong")} />
      <span className="text-caption whitespace-nowrap text-text-secondary">{caption}</span>
    </div>
  );
}

const RESULT: Record<string, { label: string; tone: BadgeTone }> = {
  passed: { label: "Passed", tone: "success" },
  failed: { label: "Failed", tone: "critical" },
  mismatch: { label: "Mismatch", tone: "high" },
  clear: { label: "Clear", tone: "success" },
  listed: { label: "Listed", tone: "critical" },
  pending: { label: "Not checked", tone: "neutral" },
};

/** C23–C25 · Device check: IMEI fails Luhn, IMEI valid, or the registry is unavailable */
export default function DeviceCheckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const now = useNow();
  const { data, isLoading } = useDeviceCheck(id);
  const { data: sub } = useSubscriber(id);
  const openCase = sub?.cases.find((c) => c.status !== "closed");
  const partial = data?.registry === "unavailable";
  const invalid = !!data && !data.luhn.valid;
  // TODO(api): 0.2 doesn’t say when the registry was last tried (C25).
  const timedOut = data?.registry_last_try ? `Registry timed out ${formatClock(data.registry_last_try)}` : "Registry didn’t respond";

  const digits = data ? digitsOf(data.imei) : [];
  const others = data?.other_sims.data ?? [];
  const tac = data?.tac;
  const reported = data?.model && tac ? data.model.replace(new RegExp(`^${tac.brand}\\s*`, "i"), "") : null;

  return (
    <CheckLayout
      subscriberId={id}
      section="Device check"
      title={data ? (data.model ? `Device check · ${data.model}` : `Device check · IMEI ${spaced(data.imei)}`) : "Device check"}
      status={
        data
          ? invalid
            ? { label: "IMEI invalid", tone: "critical" }
            : partial
              ? { label: "Check incomplete", tone: "medium" }
              : { label: "IMEI valid", tone: "success" }
          : undefined
      }
      subtitle={data ? source(data, now) : undefined}
      evidenceTitle="Device check"
      secondary={
        invalid ? (
          // Blocking an IMEI is a protective action: it goes through the case.
          <Button variant="danger-outline" size="md" onClick={() => router.push(openCase ? `/cases/${openCase.id}?protect=1` : `/subscribers/${id}`)}>
            Block IMEI
          </Button>
        ) : undefined
      }
      loading={isLoading || !data}
    >
      {data && (
        <>
          {partial ? (
            <Banner
              tone="warning"
              title="GSMA stolen-device registry didn’t respond"
              action={
                <Button variant="ghost" size="sm" onClick={() => mutate(`/subscribers/${id}/device-check`)}>
                  Retry
                </Button>
              }
            >
              The {tac ? "Luhn and model checks" : "Luhn check"} still ran. Retry the stolen-list check before you decide.
            </Banner>
          ) : invalid ? (
            <Banner tone="error" title="This IMEI is fake or has been changed">
              Its last digit doesn’t add up, so no manufacturer issued it. Fraudsters change IMEIs to get around device blocks.
            </Banner>
          ) : (
            <Banner tone="success" title="This IMEI checks out">
              Valid check digit, the model matches, and it is not on the stolen list.
            </Banner>
          )}

          <Card title={`IMEI ${spaced(data.imei)}`}>
            <div className="flex flex-col gap-3 pb-1">
              <div className="flex items-start gap-6">
                <DigitGroup digits={digits.slice(0, 8)} caption={`Make and model (TAC) · ${tac?.brand ?? (partial ? "waiting for registry" : "unknown")}`} />
                <DigitGroup digits={digits.slice(8, 14)} caption="Serial number" />
                <DigitGroup digits={digits.slice(14)} caption="Check digit" tone={invalid ? "critical" : "neutral"} />
              </div>
              {invalid && !partial && (
                <Banner tone="info" title={`The check digit should be ${data.luhn.expected_digit}`}>
                  Worked out from the first 14 digits (Luhn check). This phone reports {data.luhn.actual_digit}.
                </Banner>
              )}
            </div>
          </Card>

          <div className="flex items-stretch gap-6">
            <Card title="Device checks" className="min-w-0 flex-1">
              <ul className="flex flex-col">
                <PartyRow
                  title="Number is valid (Luhn check)"
                  sub={invalid ? `Check digit is ${data.luhn.actual_digit}, should be ${data.luhn.expected_digit}` : `Check digit ${data.luhn.actual_digit} matches`}
                  aside={<Badge {...RESULT[invalid ? "failed" : "passed"]} />}
                />
                <PartyRow
                  title="Model matches the number"
                  sub={
                    !tac
                      ? timedOut
                      : tac.matches_reported_model
                        ? `${tac.brand} ${tac.model} · TAC agrees`
                        : `Phone says ${reported ?? "another model"}, number is for a ${tac.year} model`
                  }
                  aside={<Badge {...RESULT[!tac ? "pending" : tac.matches_reported_model ? "passed" : "mismatch"]} />}
                />
                <PartyRow
                  title="Not on the GSMA stolen list"
                  sub={partial || !data.stolen ? timedOut : data.stolen.listed ? "Listed as stolen" : `Checked ${formatClock(data.stolen.checked_at)}`}
                  aside={<Badge {...RESULT[partial || !data.stolen ? "pending" : data.stolen.listed ? "listed" : "clear"]} />}
                />
              </ul>
            </Card>
            <Card
              title="Same IMEI on other SIMs"
              aside={<CardMeta>{others.length ? `${others.length} SIM${others.length > 1 ? "s" : ""} · ${data.other_sims.window_days} days` : "Only this SIM"}</CardMeta>}
              className="min-w-0 flex-1"
            >
              {others.length ? (
                <LinkedNumbers rows={others} />
              ) : sub ? (
                <LinkedNumbers rows={[{ msisdn: sub.msisdn, iccid: sub.sim.iccid, case: null }]} self={sub.msisdn} />
              ) : null}
            </Card>
          </div>
        </>
      )}
    </CheckLayout>
  );
}
