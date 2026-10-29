"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { localMsisdn } from "@/components/cases/CaseTable";
import { PERIOD, TraceBody, VERDICT_BADGE, type Trace } from "@/components/subscriber/TraceBody";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** G35–G38 · Number trace (SIM box): ready (G35), tracing (G36), no calls (G37), partial data (G38). */
export default function TracePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  // Poll until the trace is ready or has no calls.
  const { data } = useApi<Trace>(`/traces/${id}`, { refreshInterval: (t) => (t?.status === "running" ? 1500 : 0) });
  const [starting, setStarting] = useState(false);
  const period = data?.period ?? params.get("period") ?? "24h";
  const running = !data || data.status === "running";
  const ready = data?.status === "ready";

  // A trace covers one period; another period is a new trace.
  const setPeriod = async (p: string) => {
    if (!data) return;
    setStarting(true);
    try {
      const res = await apiFetch<{ id: string }>("POST", "/traces", { subscriber_id: data.subject.subscriber_id, period: p, case_id: data.case_id ?? undefined });
      router.push(`/trace/${res.id}?${new URLSearchParams({ period: p })}`, { scroll: false });
    } catch {
      toast({ title: "Couldn’t start the trace", body: "Nothing changed. Try again." });
    } finally {
      setStarting(false);
    }
  };
  const exportTrace = () => window.open(`/print/traces/${id}`, "_blank");

  const badge = running ? (
    <Badge label="Tracing" tone="info" size="md" />
  ) : data?.status === "no_calls" ? (
    <Badge label="No calls" tone="neutral" size="md" />
  ) : (
    <Badge label={VERDICT_BADGE[data.verdict?.kind ?? ""] ?? "Trace ready"} tone={data.verdict?.kind === "sim_box" ? "critical" : "neutral"} size="md" />
  );
  return (
    <>
      <AppHeader section={`Subscriber lookup / ${data?.subject.msisdn ?? ""}`} title="Terminating number trace" />
      <PageBody>
        <PageHead
          title="Where this SIM’s calls end up"
          pill={badge}
          subtitle={`${data ? localMsisdn(data.subject.msisdn) : "…"} · call records (CDRs) for the ${PERIOD[period] ?? period}`}
          actions={
            data?.status === "no_calls" ? undefined : (
              <>
                <Button variant="danger-outline" size="md" disabled={!ready || !data?.case_id} onClick={() => router.push(`/cases/${data?.case_id}?protect=1`)}>
                  Suspend SIM
                </Button>
                {data?.case_id ? (
                  <ButtonLink href={`/cases/${data.case_id}`} size="md" aria-disabled={!ready} className={cn(!ready && "pointer-events-none opacity-50")}>
                    Open case {data.case_id}
                  </ButtonLink>
                ) : (
                  <Button size="md" disabled>
                    Open case
                  </Button>
                )}
              </>
            )
          }
        />

        <TraceBody data={data} period={period} starting={starting} onPeriod={setPeriod} onExport={exportTrace} />
      </PageBody>
    </>
  );
}
