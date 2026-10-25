"use client";

import { Card } from "@/components/app/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";

/** Proposed (TODO(api)): GET /network/nodes/{id} — facts and actions for one entity. */
export type NodeDetail = {
  id: string;
  title: string;
  badges: Array<{ label: string; tone: BadgeTone }>;
  facts: Array<[string, string, ("critical" | undefined)?]>;
  actions: string[];
};

const ACTIONS: Record<string, { label: string; icon: string; tone?: "critical" }> = {
  add_to_evidence: { label: "Add to evidence", icon: "app/icon-file-plus-16" },
  block: { label: "Block wallet", icon: "app/icon-ban-critical-16", tone: "critical" },
};

/** Side panel for the selected entity (C8, G29). */
export function NodePanel({
  nodeId,
  onAction,
  busy,
}: {
  nodeId: string;
  onAction: (action: string, node: NodeDetail) => void;
  busy?: string | null;
}) {
  const { data } = useApi<NodeDetail>(`/network/nodes/${nodeId}`);
  if (!data) {
    return (
      <Card className="w-[400px] shrink-0">
        <p className="text-body-s text-text-secondary">Loading…</p>
      </Card>
    );
  }
  return (
    <section className="flex w-[400px] shrink-0 flex-col gap-3 rounded-xl border border-border-subtle bg-surface-base px-[18px] py-4">
      <h3 className="flex items-center gap-2 text-title text-text-primary">
        <Icon name="app/icon-wallet-18" size={18} />
        {data.title}
      </h3>
      {data.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.badges.map((b) => (
            <Badge key={b.label} label={b.label} tone={b.tone} />
          ))}
        </div>
      )}
      <KeyValueList rows={data.facts.map(([k, v, tone]) => [k, <span key={k} className={cn(tone === "critical" && "text-critical-fg")}>{v}</span>])} />
      <div className="flex flex-col gap-2">
        {data.actions.map((a) => {
          const linkCase = a.startsWith("link_case:") ? a.split(":")[1] : null;
          const spec = linkCase ? { label: `Link ${linkCase} to this case`, icon: "app/icon-link-16" } : ACTIONS[a];
          if (!spec) return null;
          return (
            <Button
              key={a}
              variant={"tone" in spec && spec.tone === "critical" ? "danger-outline" : "secondary"}
              size="sm"
              fullWidth
              loading={busy === a}
              onClick={() => onAction(a, data)}
              iconLeft={<Icon name={spec.icon} size={16} />}
            >
              {spec.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
