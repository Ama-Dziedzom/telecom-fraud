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

/** Vertical room per node: 40 node + 4 + a two-line label (38) + breathing space. */
const ROW = 104;

/**
 * Columns by relationship to the seed: money flows to the right (recipients,
 * then where it went next, then the case it ends in); context — the swap
 * agent, devices, other SIMs — sits to the left. Within a column, nodes sit
 * next to the neighbours that put them there (fewer crossings) and never
 * closer than ROW, so labels don’t run into the next node; the canvas grows
 * taller rather than squeezing them.
 */
function layout(network: Network, seed: string, size: { colWidth: number; height: number; pad: number; row: number }) {
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

  const neighbours = (id: string) =>
    network.edges.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : [])).filter((o) => col.has(o));

  // A case on the money side sits one column past everything it links (G28: FD-2998 right of its mule wallets).
  for (const n of network.nodes) {
    const c = col.get(n.id);
    if (n.type !== "case" || c === undefined || c <= 0) continue;
    const furthest = Math.max(...neighbours(n.id).map((o) => col.get(o)!));
    if (furthest >= c) col.set(n.id, furthest + 1);
  }

  const cols = Array.from(new Set(col.values())).sort((a, b) => a - b);
  const min = cols[0] ?? 0;
  const y = new Map<string, number>([[seed, 0]]);
  // Outward from the seed, so each column can line up with the one nearer the seed.
  const order = [...cols.filter((c) => c > 0), ...cols.filter((c) => c < 0).reverse()];
  for (const c of order) {
    const inner = c > 0 ? c - 1 : c + 1;
    const members = network.nodes
      .filter((n) => col.get(n.id) === c)
      .map((n, i) => {
        const anchors = neighbours(n.id).filter((o) => y.has(o) && Math.abs(col.get(o)! - inner) <= Math.abs(c - inner));
        const want = anchors.length ? anchors.reduce((sum, o) => sum + y.get(o)!, 0) / anchors.length : 0;
        return { id: n.id, want, i };
      })
      .sort((a, b) => a.want - b.want || a.i - b.i);
    // Spread evenly around where the column wants to be, ROW apart.
    const centre = members.reduce((sum, m) => sum + m.want, 0) / Math.max(1, members.length);
    members.forEach((m, i) => y.set(m.id, centre + (i - (members.length - 1) / 2) * size.row));
  }

  const ys = Array.from(y.values());
  const top = Math.min(...ys);
  const span = Math.max(...ys) - top;
  // Labels hang below the node, so leave more room at the bottom; centre short graphs in the canvas.
  const height = Math.max(size.height, span + size.row * 1.5);
  const offset = (height - span) / 2 - top - size.row / 4;

  const placed: Placed[] = network.nodes
    .filter((n) => col.has(n.id))
    .map((n) => ({
      ...n,
      col: col.get(n.id)!,
      seed: n.id === seed,
      x: size.pad + (col.get(n.id)! - min) * size.colWidth,
      y: y.get(n.id)! + offset,
    }));
  const width = size.pad * 2 + (cols.length - 1) * size.colWidth;
  return { placed, width, height };
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
  controls = true,
}: {
  network: Network;
  seed: string;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  height?: number;
  colWidth?: number;
  /** Smaller nodes, no roles or amounts — for the “Who’s involved” card. */
  compact?: boolean;
  /** Zoom buttons and the scroll hint (G28); the case tab (C8) fits the graph instead. */
  controls?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const { placed, width, height: canvasHeight } = useMemo(
    () => layout(network, seed, { colWidth, height, pad: compact ? 40 : 80, row: compact ? 56 : ROW }),
    [network, seed, colWidth, height, compact],
  );
  const byId = new Map(placed.map((n) => [n.id, n]));
  // A wallet that paid mules already in a case reaches that case through them (G28 draws only the mules’ links).
  const edges = useMemo(() => {
    const inCase = (from: string, to: string) => network.edges.some((e) => e.kind === "in_case" && e.from === from && e.to === to);
    return network.edges.filter(
      (e) => e.kind !== "in_case" || !network.edges.some((m) => MONEY.has(m.kind) && m.from === e.from && inCase(m.to, e.to)),
    );
  }, [network.edges]);
  const red = (n: Placed) => isRed(n, seed);
  const redEdge = (a: Placed, b: Placed) => red(a) && red(b);

  // Start fitted to the canvas; +/− zoom from there.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el || compact) return;
    // Fit both ways, so the whole graph shows; labels scale with their nodes, so nothing collides.
    const measure = () => setFit(Math.min(1, (el.clientWidth - 24) / width, el.clientHeight / canvasHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, canvasHeight, compact]);
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
        <div className="relative origin-top-left" style={{ width: width * scale, height: canvasHeight * scale }}>
          <div className="absolute top-0 left-0" style={{ width, height: canvasHeight, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <svg width={width} height={canvasHeight} className="absolute inset-0" aria-hidden>
              {edges.map((e, i) => {
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
              edges.map((e, i) => {
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
      {!compact && controls && (
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
      {!compact && controls && <p className="absolute right-4 bottom-3 text-caption text-text-tertiary">Scroll to move · +/− to zoom</p>}
    </div>
  );
}
