"use client";

import { Skeleton } from "@/components/app/Card";
import { Legend, NetworkGraph } from "@/components/network/NetworkGraph";
import { NodePanel, type NodeDetail } from "@/components/network/NodePanel";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useNetwork } from "@/lib/api/cases";
import { useState } from "react";
import { useSWRConfig } from "swr";

/** C8 · Network — follow the money from this subscriber. */
export function NetworkTab({ caseId, seed, onBlock }: { caseId: string; seed: string; onBlock: (node: NodeDetail) => void }) {
  const [hops, setHops] = useState<"1" | "2" | "3">("2");
  const { data } = useNetwork(seed, Number(hops));
  const [selected, setSelected] = useState<string | null>("w_8812");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const { mutate } = useSWRConfig();

  const act = async (action: string, node: NodeDetail) => {
    if (action === "block") return onBlock(node);
    setBusy(action);
    try {
      if (action === "add_to_evidence") {
        await apiFetch("POST", `/cases/${caseId}/evidence`, { title: node.title, entity_id: node.id });
        await mutate(`/cases/${caseId}/evidence`);
        toast({ tone: "success", title: `${node.title} added to evidence` });
      } else if (action.startsWith("link_case:")) {
        const other = action.split(":")[1];
        // TODO(api): proposed POST /cases/{id}/links {case_id}.
        await apiFetch("POST", `/cases/${caseId}/links`, { case_id: other }).catch(() => undefined);
        await mutate(`/cases/${caseId}`);
        toast({ tone: "success", title: `${other} linked to ${caseId}` });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Segmented
          label="Hops"
          value={hops}
          onChange={setHops}
          options={[
            { id: "1", label: "1 hop" },
            { id: "2", label: "2 hops" },
            { id: "3", label: "3 hops" },
          ]}
        />
        <Legend />
        <span className="flex-1" />
        <ButtonLink href={`/network?seed=${seed}`} variant="secondary" size="sm" iconLeft={<Icon name="app/icon-network-primary-16" size={16} />}>
          Open in Entity network
        </ButtonLink>
      </div>
      <div className="flex items-start gap-4">
        <div className="h-[616px] min-w-0 flex-1 overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
          {data ? (
            <NetworkGraph network={data} seed={seed} selected={selected} onSelect={setSelected} />
          ) : (
            <div className="p-6">
              <Skeleton className="h-[560px] w-full" />
            </div>
          )}
        </div>
        {selected && <NodePanel nodeId={selected} onAction={act} busy={busy} />}
      </div>
    </>
  );
}
