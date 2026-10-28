"use client";

import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { NetworkGraph } from "@/components/network/NetworkGraph";
import { NodePanel, type NodeDetail } from "@/components/network/NodePanel";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useNetwork, type CaseDetail } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { BannerLink, localMsisdn } from "./parts";

/** Names for sources that can fail to answer (`unavailable`). */
const SOURCE: Record<string, { title: string; detail: string }> = {
  cdr: { title: "Call records (CDR) didn’t load", detail: "Showing money links only. Device and call links are missing." },
  wallet: { title: "MoMo wallet links didn’t load", detail: "Showing device and call links only. Money links are missing." },
  device: { title: "Device records didn’t load", detail: "Showing money and call links only. Device links are missing." },
};
const sourceOf = (s: string) => SOURCE[s] ?? { title: `${s.toUpperCase()} didn’t load`, detail: "Some links are missing from this view." };

/** Skeleton nodes laid out roughly like the graph they stand in for (C9). */
const GHOSTS = [
  [30, 15], [60, 10], [60, 26], [30, 45], [60, 42], [78, 30], [12, 72], [60, 58], [60, 74], [78, 8],
];

/** C8 · Network — follow the money from this subscriber. C9 loading · C10 a source failed. */
export function NetworkTab({
  caseId,
  seed,
  subject,
  moneyOut,
  since,
  onBlock,
}: {
  caseId: string;
  seed: string;
  subject: string;
  moneyOut: CaseDetail["glance"]["money"];
  since?: string;
  onBlock: (node: NodeDetail) => void;
}) {
  const [hops, setHops] = useState<1 | 2 | 3>(2);
  const { data, isLoading, mutate: reload } = useNetwork(seed, hops);
  const [selected, setSelected] = useState<string | null>("wal_8812");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const loading = isLoading || !data;
  // Keep the panel on a node that is in this view.
  const focus = data && selected && data.nodes.some((n) => n.id === selected) ? selected : (data?.nodes.find((n) => n.case_ids?.length && n.id !== seed)?.id ?? null);

  const act = async (action: string, node: NodeDetail) => {
    if (action === "block") return onBlock(node);
    setBusy(action);
    try {
      if (action === "add_to_evidence") {
        // Adds the entity to the case and saves the graph around it as evidence.
        await apiFetch("POST", `/cases/${caseId}/entities`, { entity_ids: [node.id], snapshot: true });
        await mutate(`/cases/${caseId}/evidence`);
        toast({ tone: "success", title: `${node.identifier} added to evidence` });
      } else if (action.startsWith("link_case:")) {
        const other = action.split(":")[1];
        await apiFetch("POST", `/cases/${caseId}/links`, { case_id: other }).catch(() => undefined);
        await mutate(`/cases/${caseId}`);
        toast({ tone: "success", title: `${other} linked to ${caseId}` });
      }
    } finally {
      setBusy(null);
    }
  };

  const unavailable = data?.unavailable ?? [];

  return (
    <>
      <div className="flex items-center gap-3">
        <div role="radiogroup" aria-label="Hops" className="flex gap-2">
          {([1, 2, 3] as const).map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={hops === h}
              onClick={() => setHops(h)}
              className={cn(
                "h-8 rounded-lg border px-3 text-label-s",
                hops === h ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand" : "border-border-default bg-surface-base text-text-primary hover:bg-surface-raised",
              )}
            >
              {h} {h === 1 ? "hop" : "hops"}
            </button>
          ))}
        </div>
        <p className="flex-1 text-center text-caption text-text-secondary">Red: money moving to a mule wallet or a confirmed ring</p>
        <ButtonLink href={`/network?seed=${seed}`} variant="secondary" size="sm">
          Open in Entity network
        </ButtonLink>
      </div>
      {unavailable.map((s) => (
        <Banner key={s} tone="warning" title={sourceOf(s).title} action={<BannerLink onClick={() => void reload()}>Retry</BannerLink>}>
          {sourceOf(s).detail}
        </Banner>
      ))}
      <div className="flex items-start gap-6">
        <Card
          title={`Money from ${localMsisdn(subject)}, ${hops} ${hops === 1 ? "hop" : "hops"}`}
          aside={
            <CardMeta>
              {loading ? "Tracing transfers" : `${formatMoney(moneyOut.amount.amount_minor, moneyOut.amount.currency)} out${since ? ` since ${formatClock(since)}` : ""}`}
            </CardMeta>
          }
          className="min-w-0 flex-1"
        >
          <div className="relative h-[460px]">
            {loading ? (
              <div aria-busy aria-label="Loading the network" className="absolute inset-0">
                {GHOSTS.map(([x, y], i) => (
                  <span key={i} className="absolute flex flex-col items-center gap-2" style={{ left: `${x}%`, top: `${y}%` }}>
                    <Skeleton className="size-10 rounded-full" />
                    <Skeleton className="h-2 w-[60px]" />
                  </span>
                ))}
              </div>
            ) : (
              <NetworkGraph network={data} seed={seed} selected={focus} onSelect={setSelected} height={460} />
            )}
          </div>
        </Card>
        {loading ? (
          <Card className="w-[360px] shrink-0">
            <Skeleton className="h-4 w-[140px]" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-[250px]" />
              <Skeleton className="h-2.5 w-[184px]" />
            </div>
          </Card>
        ) : (
          focus && <NodePanel nodeId={focus} onAction={act} busy={busy} />
        )}
      </div>
    </>
  );
}
