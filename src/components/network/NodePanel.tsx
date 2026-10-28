"use client";

import { Card } from "@/components/app/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/Drawer";
import type { NetworkNode } from "@/lib/api/cases";
import { useApi, type Money } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatMoney, now } from "@/lib/time";
import type { ReactNode } from "react";

/** GET /network/nodes/{id}: one entity. `facts` are typed by entity; the app writes the rows. */
export type NodeDetail = {
  id: string;
  type: NetworkNode["type"];
  identifier: string;
  owner_name: string | null;
  risk: NetworkNode["risk"];
  flags: string[];
  facts: Partial<{
    opened_at: string;
    opened_where: string;
    received_today: Money;
    received_today_from_victims: number;
    sent_on_today: Money;
    sent_on_minutes: number;
    forwarded_to: string[];
    case_ids: string[];
  }>;
  /** Entities worth adding to a case with this one. */
  add_to_case?: { suggested: string[] };
};

export const NODE_TYPE: Record<NetworkNode["type"], string> = {
  subscriber: "Subscriber",
  wallet: "Wallet",
  device: "Device",
  agent: "Agent",
  case: "Case",
};

const FLAGS: Record<string, { label: string; tone: BadgeTone }> = {
  recipient: { label: "Recipient", tone: "neutral" },
  mule_pattern: { label: "Mule pattern", tone: "critical" },
};
/** Badges for a node’s flags. */
export const nodeFlags = (node: NodeDetail) => node.flags.map((f) => FLAGS[f] ?? { label: f[0].toUpperCase() + f.slice(1).replace(/_/g, " "), tone: "neutral" as const });

const money = (m: Money) => formatMoney(m.amount_minor, m.currency);

/** Fact rows: “Opened · 11 days ago · Kejetia”. `name` turns forwarded-to IDs into what the graph shows. */
export function nodeFacts(node: NodeDetail, name: (id: string) => string = (id) => id, highlight = true): Array<[string, ReactNode]> {
  const f = node.facts;
  const rows: Array<[string, string, boolean?]> = [];
  if (f.opened_at) {
    const days = Math.round((now() - Date.parse(f.opened_at)) / 86_400_000);
    rows.push(["Opened", [days < 1 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`, f.opened_where?.split(", ")[0]].filter(Boolean).join(" · ")]);
  }
  if (f.received_today) {
    const victims = f.received_today_from_victims;
    rows.push(["Received today", `${money(f.received_today)}${victims ? ` from ${victims} victim${victims === 1 ? "" : "s"}` : ""}`, true]);
  }
  if (f.sent_on_today) rows.push(["Sent on", `${money(f.sent_on_today)}${f.sent_on_minutes ? ` in ${f.sent_on_minutes} min` : ""}`, true]);
  if (f.forwarded_to?.length) rows.push(["Forwarded to", f.forwarded_to.map(name).join(" · ")]);
  if (f.case_ids?.length) rows.push(["Cases", `${f.case_ids.join(" · ")} (linked)`]);
  return rows.map(([k, v, critical]) => [
    k,
    <span key={k} className={cn(highlight && critical && "text-critical-fg")}>
      {v}
    </span>,
  ]);
}

const ACTIONS: Record<string, { label: string; icon: string; tone?: "critical" }> = {
  add_to_evidence: { label: "Add to evidence", icon: "app/icon-file-plus-16" },
  block: { label: "Block wallet", icon: "app/icon-ban-critical-16", tone: "critical" },
};

/** What the case tab offers for a node: evidence always, blocking for wallets, linking the cases it’s in. */
const actionsFor = (node: NodeDetail) => ["add_to_evidence", ...(node.type === "wallet" ? ["block"] : []), ...(node.facts.case_ids ?? []).map((c) => `link_case:${c}`)];

/** Side panel for the selected entity in a case’s network tab (C8; G29 styling). */
export function NodePanel({ nodeId, onAction, busy }: { nodeId: string; onAction: (action: string, node: NodeDetail) => void; busy?: string | null }) {
  const { data } = useApi<NodeDetail>(`/network/nodes/${nodeId}`);
  if (!data) {
    return (
      <Card className="w-[360px] shrink-0">
        <p className="text-body-s text-text-secondary">Loading…</p>
      </Card>
    );
  }
  const badges = nodeFlags(data);
  return (
    <section className="flex w-[360px] shrink-0 flex-col gap-4 rounded-lg border border-border-default bg-surface-base px-6 py-5">
      <h3 className="text-title text-text-primary">
        {NODE_TYPE[data.type]} {data.identifier}
      </h3>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <Badge key={b.label} label={b.label} tone={b.tone} />
          ))}
        </div>
      )}
      {/* C8 · values stay text/primary here: status colour lives in the pills. */}
      <KeyValueList rows={nodeFacts(data, undefined, false)} />
      <div className="flex flex-col gap-2">
        {actionsFor(data).map((a) => {
          const linkCase = a.startsWith("link_case:") ? a.split(":")[1] : null;
          const spec = linkCase
            ? { label: `Link ${linkCase} to this case`, icon: "app/icon-link-16" }
            : a === "add_to_evidence"
              ? { ...ACTIONS[a], label: `Add ${NODE_TYPE[data.type].toLowerCase()} to evidence` }
              : ACTIONS[a];
          if (!spec) return null;
          return (
            <Button
              key={a}
              variant={"tone" in spec && spec.tone === "critical" ? "danger-outline" : "secondary"}
              size="md"
              fullWidth
              loading={busy === a}
              onClick={() => onAction(a, data)}
            >
              {spec.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
