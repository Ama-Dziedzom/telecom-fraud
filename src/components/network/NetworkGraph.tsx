"use client";

import { Icon } from "@/components/ui/Icon";
import type { Network, NetworkEdge, NetworkNode } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Direction v2 colour rule for the graph: red only where money moves to a mule
 * wallet or a confirmed ring (and the subject it left); grey for everything else.
 */
export const isRed = (n: NetworkNode, seed: string) => n.id === seed || n.risk === "confirmed" || n.relation === "mule";
const GLYPH: Record<NetworkNode["type"], string> = {
  subscriber: "app/glyph-user",
  wallet: "app/glyph-wallet",
  device: "app/glyph-phone",
  agent: "app/glyph-building",
  case: "app/glyph-folder",
};
const MONEY = new Set(["paid", "cashed_out_at"]);

const RELATION: Record<string, string> = {
  subject: "Subscriber",
  swap_agent: "Swap agent",
  new_device: "New device",
  same_device: "Same device",
  other_swap: "Other swap",
  recipient: "Recipient",
  cash_out_agent: "Cash-out",
  mule: "Mule",
};

/** Caption under a node: “Recipient”, “Subscriber · FD-3050”, “Confirmed ring”. */
export function nodeRole(n: NetworkNode) {
  if (!n.relation) return "";
  if (n.type === "case") return n.risk === "confirmed" ? "Confirmed ring" : "Linked case";
  const role = RELATION[n.relation] ?? n.relation.replace(/_/g, " ");
  return [role, ...(n.case_ids ?? [])].join(" · ");
}

/** The one-line key under the graph. */
export function Legend() {
  return <p className="text-caption text-text-secondary">Red: money moving to a mule wallet or a confirmed ring. Grey: everything else.</p>;
}

/** “+233 54 *** 3457” → “054 *** 3457” on the canvas. */
const shortLabel = (label: string) => label.replace(/^\+233\s?(\d{2})\s?/, "0$1 ");

type Placed = NetworkNode & { x: number; y: number; col: number; seed: boolean };

/**
 * Columns by relationship to the seed: money flows to the right (recipients,
 * then where it went next, then the case it ends in); context — the swap
 * agent, devices, other SIMs — sits to the left.
 */
function layout(network: Network, seed: string, size: { colWidth: number; height: number; pad: number }) {
  const byId = new Map(network.nodes.map((n) => [n.id, n]));
  const col = new Map<string, number>([[seed, 0]]);
  const queue = [seed];
  while (queue.length) {
    const id = queue.shift()!;
    const c = col.get(id)!;
    for (const e of network.edges) {
      const other = e.from === id ? e.to : e.to === id ? e.from : null;
      if (!other || col.has(other) || !byId.has(other)) continue;
      let next: number;
      if (MONEY.has(e.kind) || e.kind === "in_case") next = e.from === id ? c + 1 : c - 1;
      else next = c <= 0 ? c - 1 : c + 1;
      col.set(other, next);
      queue.push(other);
    }
  }
  const cols = Array.from(new Set(col.values())).sort((a, b) => a - b);
  const min = cols[0] ?? 0;
  const placed: Placed[] = [];
  for (const c of cols) {
    const members = network.nodes.filter((n) => col.get(n.id) === c);
    const step = size.height / (members.length + 1);
    members.forEach((n, i) => {
      placed.push({
        ...n,
        col: c,
        seed: n.id === seed,
        x: size.pad + (c - min) * size.colWidth,
        y: members.length === 1 && n.id === seed ? size.height / 2 : step * (i + 1),
      });
    });
  }
  const width = size.pad * 2 + (cols.length - 1) * size.colWidth;
  return { placed, width };
}

function edgePath(a: Placed, b: Placed) {
  const [from, to] = a.x <= b.x ? [a, b] : [b, a];
  const dx = (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

const formatAmount = (e: NetworkEdge) => (e.amount ? (e.amount.amount_minor / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 }) : null);

/** C8/G28/G29 · Graph of who and what is connected. Click a node to focus it. */
export function NetworkGraph({
  network,
  seed,
  selected,
  onSelect,
  height = 600,
  colWidth = 210,
  compact = false,
}: {
  network: Network;
  seed: string;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  height?: number;
  colWidth?: number;
  /** Smaller nodes, no roles or amounts — for the “Who’s involved” card. */
  compact?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const { placed, width } = useMemo(() => layout(network, seed, { colWidth, height, pad: compact ? 40 : 80 }), [network, seed, colWidth, height, compact]);
  const byId = new Map(placed.map((n) => [n.id, n]));
  const red = (n: Placed) => isRed(n, seed);
  const redEdge = (a: Placed, b: Placed) => red(a) && red(b);

  // Start fitted to the canvas width; +/− zoom from there.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el || compact) return;
    const measure = () => setFit(Math.min(1, (el.clientWidth - 24) / width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, compact]);
  const scale = zoom * fit;

  // Focus: the selected node, its neighbours and the seed; everything else fades.
  const focus = useMemo(() => {
    if (!selected) return null;
    const ids = new Set([selected, seed]);
    for (const e of network.edges) {
      if (e.from === selected) ids.add(e.to);
      if (e.to === selected) ids.add(e.from);
    }
    // Keep the money trail from the seed to the selection lit.
    for (const e of network.edges) if (ids.has(e.to) && e.from === seed && MONEY.has(e.kind)) ids.add(e.to);
    return ids;
  }, [selected, seed, network.edges]);
  const lit = (id: string) => !focus || focus.has(id);
  const edgeLit = (e: NetworkEdge) => focus && focus.has(e.from) && focus.has(e.to) && (e.from === selected || e.to === selected || e.from === seed);

  return (
    <div className="relative size-full">
      <div ref={box} className="size-full overflow-auto">
        <div className="relative origin-top-left" style={{ width: width * scale, height: (height + 60) * scale }}>
          <div className="absolute top-0 left-0" style={{ width, height: height + 60, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <svg width={width} height={height + 60} className="absolute inset-0" aria-hidden>
              {network.edges.map((e, i) => {
                const a = byId.get(e.from);
                const b = byId.get(e.to);
                if (!a || !b) return null;
                const hot = edgeLit(e);
                const r = redEdge(a, b);
                return (
                  <path
                    key={i}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke={r ? "var(--color-critical-solid)" : hot ? "var(--color-text-secondary)" : "var(--color-border-strong)"}
                    strokeWidth={r ? 2 : hot ? 1.5 : 1}
                    strokeDasharray={e.kind === "in_case" ? "4 4" : undefined}
                    opacity={focus && !hot ? 0.4 : 1}
                  />
                );
              })}
            </svg>
            {!compact &&
              network.edges.map((e, i) => {
                const a = byId.get(e.from);
                const b = byId.get(e.to);
                const label = formatAmount(e) ?? (e.kind === "swapped_by" ? "SIM swap" : null);
                if (!a || !b || !label) return null;
                const hot = edgeLit(e);
                // The first red hop carries the currency (“GHS 7,200”); the rest just the amount.
                const r = redEdge(a, b);
                const first = r && e.from === seed && e.amount;
                return (
                  <span
                    key={`l${i}`}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 rounded border bg-surface-base px-1.5 py-px text-caption",
                      r ? "border-critical-border text-critical-fg" : "border-border-default text-text-secondary",
                    )}
                    style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2, opacity: focus && !hot ? 0.4 : 1 }}
                  >
                    {first ? `${e.amount!.currency} ${label}` : label}
                  </span>
                );
              })}
            {placed.map((n) => {
              const size = compact ? 32 : 40;
              const r = red(n);
              const isSelected = n.id === selected;
              return (
                <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, opacity: lit(n.id) ? 1 : 0.4 }}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(isSelected ? null : n.id)}
                    aria-pressed={isSelected}
                    aria-label={`${n.type} ${n.label}`}
                    className={cn(
                      "icon-tint absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px]",
                      r ? "border-critical-solid bg-critical-bg text-critical-fg" : "border-border-strong bg-surface-raised text-text-secondary",
                      isSelected && "shadow-focus",
                    )}
                    style={{ width: size, height: size }}
                  >
                    <Icon name={GLYPH[n.type]} size={compact ? 14 : 16} />
                  </button>
                  <span
                    className={cn(
                      "absolute flex flex-col text-caption whitespace-nowrap",
                      // Compact: labels sit beside the node so stacked wallets don’t collide.
                      compact && !n.seed && n.col > 0 ? "-translate-y-1/2 items-start" : "-translate-x-1/2 items-center",
                    )}
                    style={compact && !n.seed && n.col > 0 ? { left: size / 2 + 8, top: 0 } : { top: size / 2 + 4 }}
                  >
                    <span className={cn("text-body-s", isSelected ? "text-text-brand" : "text-text-primary")}>{shortLabel(n.label)}</span>
                    {!compact && n.relation && <span className={r ? "text-critical-fg" : "text-text-secondary"}>{nodeRole(n)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="absolute right-3.5 bottom-12 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
            className="flex size-8 items-center justify-center rounded-lg border border-border-default bg-surface-base hover:bg-surface-raised"
          >
            <Icon name="app/icon-zoom-in-20" size={16} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="flex size-8 items-center justify-center rounded-lg border border-border-default bg-surface-base text-title text-text-secondary hover:bg-surface-raised"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Fit to screen"
            onClick={() => setZoom(1)}
            className="flex size-8 items-center justify-center rounded-lg border border-border-default bg-surface-base hover:bg-surface-raised"
          >
            <Icon name="app/icon-fit-20" size={16} />
          </button>
        </div>
      )}
      {!compact && <p className="absolute right-4 bottom-3 text-caption text-text-tertiary">Scroll to move · +/− to zoom</p>}
    </div>
  );
}
