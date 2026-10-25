"use client";

import { Card } from "@/components/app/Card";
import { CheckLayout, LinkedNumbers, Verdict } from "@/components/subscriber/CheckLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useDeviceCheck } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/time";
import { useParams, useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

const spaced = (imei: string) => `${imei.slice(0, 2)} ${imei.slice(2, 8)} ${imei.slice(8, 14)} ${imei.slice(14)}`;

function Check({ state, title, detail }: { state: "pass" | "fail" | "warn" | "pending"; title: string; detail: string }) {
  const tile = { pass: "bg-success-bg", fail: "bg-critical-bg", warn: "bg-medium-bg", pending: "bg-neutral-bg" }[state];
  const icon = {
    pass: "app/icon-check-success-16",
    fail: "app/icon-x-critical-16",
    warn: "app/icon-alert-triangle-medium-16",
    pending: "app/icon-circle-dashed-16",
  }[state];
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px]", tile)}>
        <Icon name={icon} size={16} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-label-m text-text-primary">{title}</span>
        <span className="text-body-s text-text-secondary">{detail}</span>
      </span>
    </li>
  );
}

/** C23–C25 · Device check: IMEI valid, invalid, or registry unavailable */
export default function DeviceCheckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data, isLoading } = useDeviceCheck(id);
  const partial = data?.registry === "unavailable";
  const invalid = data && !data.luhn.valid;
  const lastTry = data?.registry_last_try ? formatClock(data.registry_last_try) : "";

  const digits = data?.imei.split("") ?? [];
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
      subtitle={data?.source}
      evidenceTitle="Device check"
      loading={isLoading || !data}
    >
      {data && (
        <>
          {invalid ? (
            <Verdict
              tone="critical"
              icon="app/icon-fingerprint-critical-22"
              title="This IMEI is fake or has been changed"
              actions={
                <Button variant="danger" size="md" onClick={() => router.push(`/subscribers/${id}`)} iconLeft={<Icon name="app/icon-ban-white-18" size={18} />}>
                  Block this IMEI
                </Button>
              }
            >
              Its last digit doesn’t add up, so no manufacturer issued this number. Fraudsters change IMEIs to get around device blocks.
            </Verdict>
          ) : partial ? (
            <Verdict
              tone="medium"
              icon="app/icon-fingerprint-medium-22"
              title="Only partly checked"
              actions={
                <Button variant="secondary" size="md" onClick={() => mutate(`/subscribers/${id}/device-check`)} iconLeft={<Icon name="app/icon-refresh-primary-18" size={18} />}>
                  Retry now
                </Button>
              }
            >
              The number itself is valid, but the GSMA device registry didn’t answer, so model and stolen-list checks are still pending. We’ll retry every 2 minutes.
            </Verdict>
          ) : (
            <Verdict tone="success" icon="app/icon-shield-check-success-22" title="This phone checks out">
              Valid IMEI, the model matches what the phone reports, and it isn’t on the stolen list.
            </Verdict>
          )}

          <Card title={`IMEI ${spaced(data.imei)}`} icon="app/icon-fingerprint-secondary-18">
            <div className="flex items-center gap-1.5">
              {digits.map((d, i) => (
                <span key={i} className={cn("flex items-center", i === 8 || i === 14 ? "pl-3" : undefined)}>
                  <span
                    className={cn(
                      "flex h-[60px] w-12 items-center justify-center rounded-lg border font-mono text-[26px] leading-8 font-medium",
                      i < 8
                        ? "border-border-subtle bg-brand-primary-subtle text-text-primary"
                        : i < 14
                          ? "border-border-subtle bg-surface-raised text-text-primary"
                          : data.luhn.valid
                            ? "border-success-fg bg-success-bg text-success-fg"
                            : "border-critical-fg bg-critical-bg text-critical-fg",
                    )}
                  >
                    {d}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex gap-6">
              {[
                ["w-[426px]", "bg-brand-primary", `Make & model (TAC) · ${partial ? "waiting for registry" : data.tac?.brand ?? "unknown"}`],
                ["w-[318px]", "bg-border-strong", "Serial number"],
                ["w-12", data.luhn.valid ? "bg-success-fg" : "bg-critical-fg", "Check digit"],
              ].map(([w, bar, label]) => (
                <span key={label} className={cn("flex flex-col gap-0.5", w)}>
                  <span className={cn("h-[3px] rounded-[2px]", bar)} />
                  <span className="text-caption font-medium whitespace-nowrap text-text-secondary">{label}</span>
                </span>
              ))}
            </div>
            <p className="flex w-fit items-center gap-2.5 rounded-[10px] bg-surface-sunken px-4 py-3 text-body-m text-text-secondary">
              <Icon name="app/icon-info-secondary-16" size={16} />
              {data.luhn.valid ? (
                <>
                  Check digit is <span className="font-mono text-mono-m text-success-fg">{data.luhn.actual}</span> it matches the Luhn check on the first 14 digits.
                </>
              ) : (
                <>
                  The check digit should be <span className="font-mono text-mono-m text-success-fg">{data.luhn.expected}</span> (Luhn check on the first 14 digits). This phone
                  reports <span className="font-mono text-mono-m text-critical-fg">{data.luhn.actual}</span>.
                </>
              )}
            </p>
          </Card>

          <div className="flex items-stretch gap-4">
            <Card title="Device checks" icon="app/icon-shield-secondary-18" className="min-w-0 flex-1">
              <ul className="flex flex-col">
                <Check
                  state={data.luhn.valid ? "pass" : "fail"}
                  title="Number is valid (Luhn check)"
                  detail={data.luhn.valid ? `Passed · check digit ${data.luhn.actual}` : `Failed · check digit is ${data.luhn.actual}, should be ${data.luhn.expected}`}
                />
                <Check
                  state={partial ? "pending" : data.tac?.matches ? "pass" : "warn"}
                  title="Model matches the number"
                  detail={partial ? `Couldn’t reach the GSMA registry · last try ${lastTry}` : data.tac?.note ?? ""}
                />
                <Check
                  state={partial ? "pending" : data.stolen?.listed ? "fail" : "pass"}
                  title="Not on the GSMA stolen list"
                  detail={
                    partial
                      ? `Couldn’t reach the GSMA registry · last try ${lastTry}`
                      : data.stolen?.listed
                        ? "Listed as stolen"
                        : `Not listed · checked ${data.stolen ? formatClock(data.stolen.checked_at) : ""}`
                  }
                />
              </ul>
            </Card>
            <Card
              title={invalid ? "Same IMEI on other SIMs" : "Other SIMs on this phone"}
              icon="app/icon-sim-18"
              aside={<Badge label={data.other_window} tone={data.other_sims.length ? "high" : "success"} />}
              className="min-w-0 flex-1"
            >
              {data.other_sims.length ? (
                <LinkedNumbers rows={data.other_sims} />
              ) : (
                <p className="flex items-center gap-2.5 py-3 text-body-m text-text-secondary">
                  <Icon name="app/icon-check-circle-success-18" size={18} />
                  None in 90 days: only her SIM has been in this phone.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </CheckLayout>
  );
}
