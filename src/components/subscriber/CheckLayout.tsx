"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useSubscriber } from "@/lib/api/fd";
import type { LinkedCase } from "@/lib/api/subscribers";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { CardSkeleton, localNumber, PartyRow, StatTileSkeleton } from "./ProfileParts";

/**
 * C19–C26 · The analysis checks: page header (H2 + status pill, meta line,
 * one secondary action + “Add to case”), then the check’s own cards.
 */
export function CheckLayout({
  subscriberId,
  section,
  title,
  status,
  subtitle,
  loadingSubtitle = "running the check",
  evidenceTitle,
  exportLabel = "Export",
  secondary,
  loading,
  skeleton,
  children,
}: {
  subscriberId: string;
  section: string;
  title: string;
  status?: { label: string; tone: BadgeTone };
  subtitle?: ReactNode;
  /** Meta line while the check loads (C20: “building his 90-day profile”). */
  loadingSubtitle?: string;
  /** What “Add to case” saves, e.g. “SIM duplication check”. */
  evidenceTitle: string;
  exportLabel?: string;
  /** Replaces Export, e.g. “Block SIM” (Danger outline) when the check found something. */
  secondary?: ReactNode;
  loading: boolean;
  /** Loading layout; defaults to a row of tiles and two cards. */
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  const { data: sub } = useSubscriber(subscriberId);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [adding, setAdding] = useState(false);
  const openCase = sub?.cases.find((c) => c.status !== "closed");
  const who = sub ? `${sub.name} · ${localNumber(sub.msisdn)}` : null;

  const add = async () => {
    if (!openCase) return;
    setAdding(true);
    try {
      // TODO(api): POST /cases/{id}/evidence takes files and transactions in 0.2, not a saved check.
      await apiFetch("POST", `/cases/${openCase.id}/evidence`, { title: evidenceTitle, check: { subscriber_id: subscriberId, kind: section } });
      await mutate(`/cases/${openCase.id}/evidence`);
      toast({ tone: "success", title: `Added to ${openCase.id}`, body: `“${evidenceTitle}” is on the Evidence tab.` });
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <AppHeader title={section} />
      <PageBody>
        <PageHead
          title={title}
          pill={!loading && status ? <Badge label={status.label} tone={status.tone} size="md" /> : undefined}
          subtitle={loading ? [who, loadingSubtitle].filter(Boolean).join(" · ") : subtitle}
          actions={
            <>
              {secondary ?? (
                <Button variant="secondary" size="md" onClick={() => window.print()}>
                  {exportLabel}
                </Button>
              )}
              {openCase && (
                <Button size="md" onClick={add} loading={adding} disabled={loading}>
                  Add to case {openCase.id}
                </Button>
              )}
            </>
          }
        />
        <div className="flex flex-col gap-4" aria-busy={loading || undefined}>
          {loading
            ? (skeleton ?? (
                <>
                  <div className="flex gap-3">
                    {Array.from({ length: 5 }, (_, i) => (
                      <StatTileSkeleton key={i} />
                    ))}
                  </div>
                  <CardSkeleton />
                  <div className="flex gap-6">
                    <CardSkeleton className="min-w-0 flex-1" />
                    <CardSkeleton className="min-w-0 flex-1" />
                  </div>
                </>
              ))
            : children}
        </div>
      </PageBody>
    </>
  );
}

const OUTCOME: Record<string, string> = {
  confirmed_fraud: "confirmed fraud",
  false_positive: "false positive",
  inconclusive: "inconclusive",
};

/** Numbers this SIM or IMEI has also been on: number, SIM, and the case it’s in. */
export function LinkedNumbers({ rows, self }: { rows: Array<{ msisdn: string; iccid?: string; case: LinkedCase | null }>; self?: string }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <PartyRow
          key={r.msisdn}
          title={localNumber(r.msisdn)}
          sub={r.iccid ? `SIM ${r.iccid}` : undefined}
          aside={
            r.case ? (
              <Badge label={`${r.case.id} · ${OUTCOME[r.case.outcome] ?? r.case.outcome.replace(/_/g, " ")}`} tone="critical" />
            ) : r.msisdn === self ? (
              <Badge label="This subscriber" tone="neutral" />
            ) : (
              <Badge label="No case yet" tone="neutral" />
            )
          }
        />
      ))}
    </ul>
  );
}
