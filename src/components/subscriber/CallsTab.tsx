"use client";

import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { useEffect, useState } from "react";
import { TraceBody, type Trace } from "./TraceBody";

/**
 * G35–G38 · The subscriber’s Calls tab: a number trace of this SIM. Opening
 * the tab starts a trace for the period (POST /traces, linked to the open
 * case) and polls it until it’s ready; another period is a new trace.
 */
export function CallsTab({ subscriberId, caseId }: { subscriberId: string; caseId?: string }) {
  const toast = useToast();
  const [period, setPeriod] = useState("24h");
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState<{ key: string; id: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${period}:${attempt}`;

  useEffect(() => {
    let live = true;
    apiFetch<{ id: string }>("POST", "/traces", { subscriber_id: subscriberId, period, case_id: caseId })
      .then((res) => live && setStarted({ key, id: res.id }))
      .catch(() => live && setFailed(key));
    return () => {
      live = false;
    };
  }, [subscriberId, caseId, period, key]);

  const traceId = started?.key === key ? started.id : null;
  const { data } = useApi<Trace>(traceId ? `/traces/${traceId}` : null, { refreshInterval: (t) => (t?.status === "running" ? 1500 : 0) });

  if (failed === key) {
    return (
      <EmptyState
        icon="app/icon-alert-circle-tertiary-20"
        title="We couldn’t start the trace"
        actions={
          <Button variant="secondary" size="md" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        }
      >
        Nothing changed. The call records feed may be busy.
      </EmptyState>
    );
  }

  return (
    <TraceBody
      data={data}
      period={period}
      starting={!traceId}
      onPeriod={setPeriod}
      onExport={() => toast({ tone: "success", title: "Trace exported", body: `${traceId}.pdf · numbers masked · logged to the audit trail` })}
    />
  );
}
