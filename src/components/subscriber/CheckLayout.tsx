"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useSubscriber } from "@/lib/api/fd";
import type { LinkedCase } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";

/** Header for the analysis checks: H2 title + status, subtitle, Export and “Add to case”. */
export function CheckLayout({
  subscriberId,
  section,
  title,
  status,
  subtitle,
  evidenceTitle,
  exportLabel = "Export",
  loading,
  children,
}: {
  subscriberId: string;
  section: string;
  title: ReactNode;
  status?: { label: string; tone: BadgeTone };
  subtitle?: ReactNode;
  /** What “Add to case” saves, e.g. “SIM duplication check”. */
  evidenceTitle: string;
  exportLabel?: string;
  loading: boolean;
  children: ReactNode;
}) {
  const { data: sub } = useSubscriber(subscriberId);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [adding, setAdding] = useState(false);
  const openCase = sub?.cases.find((c) => c.status !== "closed");

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
      <AppHeader section={`Subscriber lookup  /  ${sub?.msisdn ?? "…"}`} title={section} />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2.5 text-h2 text-text-primary">
              {title}
              {status && <Badge label={status.label} tone={status.tone} size="md" dot />}
            </h2>
            {subtitle && <p className="text-body-m text-text-secondary">{subtitle}</p>}
          </div>
          <span className="flex-1" />
          <Button variant="secondary" size="md" onClick={() => window.print()} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
            {exportLabel}
          </Button>
          {openCase && status?.tone !== "success" && status?.tone !== "medium" && (
            <Button size="md" onClick={add} loading={adding} iconLeft={<Icon name="app/icon-plus-white-18" size={18} />}>
              Add to case {openCase.id}
            </Button>
          )}
        </div>
        {loading ? (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-[78px] w-full rounded-xl" />
            <Skeleton className="h-[220px] w-full rounded-xl" />
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
        ) : (
          children
        )}
      </PageBody>
    </>
  );
}

const VERDICT = {
  critical: { box: "border-critical-border bg-critical-bg", title: "text-critical-fg" },
  medium: { box: "border-medium-border bg-medium-bg", title: "text-medium-fg" },
  success: { box: "border-success-border bg-success-bg", title: "text-success-fg" },
};

/** Verdict — white icon tile, H3 headline, one sentence, one action. */
export function Verdict({
  tone,
  icon,
  title,
  children,
  actions,
}: {
  tone: keyof typeof VERDICT;
  icon: string;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("flex items-center gap-4 rounded-xl border px-5 py-4", VERDICT[tone].box)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-surface-base">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className={cn("text-h3", VERDICT[tone].title)}>{title}</p>
        <p className="text-body-m text-text-secondary">{children}</p>
      </div>
      <span className="flex-1" />
      {actions}
    </section>
  );
}

const OUTCOME: Record<string, string> = {
  confirmed_fraud: "Confirmed fraud",
  false_positive: "False positive",
  inconclusive: "Inconclusive",
};

/** “+233 24 *** 6610  FD-2998 · Confirmed fraud” rows. */
export function LinkedNumbers({ rows, sims }: { rows: Array<{ msisdn: string; iccid?: string; case: LinkedCase | null }>; sims?: boolean }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.msisdn} className="flex items-center gap-3 py-2.5">
          <Icon name="app/icon-sim-tertiary-16" size={16} />
          {sims && r.iccid && <span className="font-mono text-mono-s text-text-secondary">{r.iccid}</span>}
          <span className="font-mono text-mono-m text-text-primary">{r.msisdn}</span>
          {r.case ? <Badge label={`${r.case.id} · ${OUTCOME[r.case.outcome] ?? r.case.outcome.replace(/_/g, " ")}`} tone="critical" /> : <Badge label="No case yet" tone="neutral" />}
        </li>
      ))}
    </ul>
  );
}
