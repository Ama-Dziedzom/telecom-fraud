"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { TooltipBubble, tooltipOnHover } from "@/components/ui/Tooltip";
import { useEffect, useRef, useState } from "react";
import { BUCKETS, LEVELS, type Level, type Pin } from "./geo";

/** What the map draws: how hot each boundary is (0–4), the hotspot pins and the agents. Names come from the page. */
export type Layers = {
  shapes: Array<{ id: string; intensity: number }>;
  /** `hot` = the hotspot to act on (the hottest area): the only red on the map, as a ring. */
  pins: Array<{ id: string; name: string; alerts: number; hot?: boolean }>;
  agents: Array<{ code: string; hot: boolean }>;
};

const H = 640;

/** Leader from the pin’s centre to the near side of its label (labels are ~8px/char + padding). */
function leader(pin: Pin, name: string, value: number) {
  const cx = pin.x + pin.size / 2;
  const cy = pin.y + pin.size / 2;
  const [lx, ly] = pin.label;
  const w = name.length * 6.6 + String(value).length * 7.2 + 22;
  const tx = lx + w < cx ? lx + w : lx > cx ? lx : lx + w / 2;
  return { cx, cy, tx, ty: ly + 13 };
}

/** G21–G25 · The map canvas: boundaries in the blue density ramp, hotspots with labels (a red ring only on the one to act on), zoom and drag. */
export function HeatMap({
  level,
  layers,
  legendTitle,
  focus,
  onDrill,
  onPin,
  overlay,
  children,
}: {
  level: Level["id"];
  layers: Layers;
  legendTitle: string;
  /** Region outlined when a filter has emptied the map (G25). */
  focus?: string;
  onDrill: (area: string) => void;
  onPin: (id: string) => void;
  /** Card shown over the map (empty state). */
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const geo = LEVELS[level];
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFit(Math.min(1, e.contentRect.width / 930)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pins = new Map(layers.pins.map((p) => [p.id, p]));
  const intensity = new Map(layers.shapes.map((s) => [s.id, s.intensity]));
  const on = (layer: string) => visible[layer] !== false;
  const scale = fit * zoom;
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      ref={box}
      className="relative h-[640px] min-w-0 flex-1 touch-none overflow-hidden rounded-lg border border-border-default bg-surface-sunken select-none"
      style={{ height: H * fit }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y });
      }}
      onPointerUp={() => (drag.current = null)}
      onWheel={(e) => setZoom((z) => Math.min(2.5, Math.max(1, z - Math.sign(e.deltaY) * 0.25)))}
    >
      <div
        role="img"
        aria-label={`Map of ${level === "country" ? "Ghana by region" : level === "ashanti" ? "Ashanti by district" : "Kumasi by neighbourhood"}`}
        className="absolute top-0 origin-top-left"
        style={{ left: 0, width: 930, height: H, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "465px 320px" }}
      >
        <div className="absolute top-0" style={{ left: geo.left, width: geo.width, height: H }}>
          {geo.base.map((b) => (
            <div key={b.src} className="absolute" style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
              <div className="absolute" style={{ inset: b.inset }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src={b.src} className="block size-full max-w-none" />
              </div>
            </div>
          ))}
          {on(geo.layers[0]) &&
            geo.shapes.map((s) => {
              const bucket = intensity.get(s.id) ?? 0;
              const focused = focus === s.id;
              return (
                <div key={s.id} className="group/tip absolute" style={{ left: s.x, top: s.y, width: s.w, height: s.h }}>
                  <TooltipBubble title={s.name} body={`${bucket ? geo.legend[bucket] : "No"} alerts`} className={tooltipOnHover("top")} style={{ top: "50%", bottom: "auto", marginTop: -8 }} />
                  <span
                    aria-hidden
                    className="absolute block"
                    style={{
                      inset: s.inset,
                      background: focused ? "var(--color-border-default)" : BUCKETS[bucket],
                      maskImage: `url(${s.src})`,
                      maskSize: "100% 100%",
                      WebkitMaskImage: `url(${s.src})`,
                      WebkitMaskSize: "100% 100%",
                    }}
                  />
                  <div className="absolute" style={{ inset: s.inset }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      src={s.src.replace(/\.svg$/, "-outline.svg")}
                      className={cn(
                        "block size-full max-w-none",
                        focused && "[filter:drop-shadow(0_0_1px_var(--color-brand-primary))_drop-shadow(0_0_1px_var(--color-brand-primary))]",
                      )}
                    />
                  </div>
                </div>
              );
            })}
          {geo.overlays.map((o) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={o.src} alt="" src={o.src} className="absolute block max-w-none" style={{ left: o.x, top: o.y, width: o.w, height: o.h }} />
          ))}
          {geo.places.map((p) =>
            p.kind === "caps" ? (
              <span
                key={p.name + p.x}
                className="absolute text-overline whitespace-nowrap text-text-tertiary uppercase opacity-80"
                style={{ left: p.x, top: p.y, letterSpacing: "1.4px" }}
              >
                {p.name}
              </span>
            ) : p.kind === "sea" || p.kind === "water" ? (
              <span key={p.name} className="absolute text-caption whitespace-nowrap text-text-tertiary" style={{ left: p.x, top: p.y }}>
                {p.name}
              </span>
            ) : (
              <span key={p.name + p.x} className="absolute flex items-center gap-1" style={{ left: p.x, top: p.y - (p.kind === "hood" ? 7.5 : 6) }}>
                <span className={cn("shrink-0 rounded-full bg-text-tertiary", p.kind === "hood" ? "size-[5px]" : "size-1.5")} />
                <span className={cn("text-caption whitespace-nowrap text-text-secondary", p.kind === "hood" && "rounded bg-white/80 px-1")}>{p.name}</span>
              </span>
            ),
          )}

          {on(geo.layers[2] ?? "") &&
            geo.agents?.map((a) => {
              const hot = layers.agents.find((x) => x.code === a.id)?.hot;
              return (
                <span
                  key={a.id}
                  className={cn(
                    "group/tip absolute flex size-5 items-center justify-center rounded-[6px] border-2 border-surface-base",
                    hot ? "bg-chart-1 outline-2 outline-offset-1 outline-critical-solid" : "bg-chart-6",
                  )}
                  style={{ left: a.x, top: a.y }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src="/figma/map/agent-building.svg" className="size-[11px]" />
                  <TooltipBubble title={a.id} className={tooltipOnHover("top")} />
                </span>
              );
            })}

          {on(geo.layers[1]) && (
            <>
              <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={geo.width} height={H}>
                {geo.pins.map((pin) => {
                  const p = pins.get(pin.id);
                  if (!p) return null;
                  const l = leader(pin, p.name, p.alerts);
                  return <line key={pin.id} x1={l.cx} y1={l.cy} x2={l.tx} y2={l.ty} stroke="var(--color-text-primary)" strokeWidth={1} />;
                })}
              </svg>
              {geo.pins.map((pin) => {
                const p = pins.get(pin.id);
                if (!p) return null;
                const ring = level === "ashanti";
                return (
                  <span key={pin.id}>
                    <button
                      type="button"
                      aria-label={`${p.name}: ${p.alerts} alerts${p.hot ? ", act on this one" : ""}${pin.drill ? ", zoom in" : ""}`}
                      onClick={() => (pin.drill ? onDrill(pin.drill) : onPin(pin.id))}
                      className={cn(
                        "absolute flex items-center justify-center rounded-full text-caption font-medium text-text-inverse",
                        ring ? "border-[1.5px] border-surface-inverse bg-surface-base/40" : "border-2 border-surface-base bg-surface-inverse shadow-sm",
                        p.hot && "outline-2 outline-offset-1 outline-critical-solid",
                      )}
                      style={{ left: pin.x, top: pin.y, width: pin.size, height: pin.size }}
                    >
                      {ring ? <span className="size-1.5 rounded-full bg-surface-inverse" /> : pin.size >= 24 ? p.alerts : null}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => (pin.drill ? onDrill(pin.drill) : onPin(pin.id))}
                      className="absolute flex items-center gap-1.5 rounded bg-surface-base px-2 py-1 text-caption whitespace-nowrap text-text-primary shadow-sm"
                      style={{ left: pin.label[0], top: pin.label[1] }}
                    >
                      {p.name}
                      <span className={p.hot ? "text-critical-fg" : "text-text-secondary"}>{p.alerts}</span>
                    </button>
                  </span>
                );
              })}
            </>
          )}
          {geo.hint && pins.size > 0 && (
            <button
              type="button"
              onClick={() => onDrill(geo.hint!.drill)}
              className="absolute flex items-center gap-1.5 rounded-full bg-brand-primary px-2.5 py-1.5 text-caption font-medium text-text-inverse shadow-md"
              style={{ left: geo.hint.x, top: geo.hint.y }}
            >
              <Icon name="app/icon-search-white-18" size={14} />
              {geo.hint.text}
            </button>
          )}
        </div>
      </div>

      {overlay && <div className="absolute inset-x-0 bottom-[60px] flex justify-center">{overlay}</div>}
      {/* Chrome — not scaled with the map. */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        {children}
        {/* Foundations · Legend item (1319:167790) chips that toggle each layer. */}
        <div className="flex w-fit gap-0.5 rounded-lg border border-border-default bg-surface-base p-1 shadow-sm">
          {geo.layers.map((layer, i) => (
            <button
              key={layer}
              type="button"
              aria-pressed={on(layer)}
              onClick={() => setVisible((v) => ({ ...v, [layer]: !on(layer) }))}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption", on(layer) ? "bg-surface-sunken text-text-primary" : "text-text-tertiary")}
            >
              <span className={cn("size-2.5", i === 0 ? "rounded-[3px] bg-seq-4" : i === 1 ? "rounded-full bg-surface-inverse" : "rounded-[3px] bg-chart-1")} />
              {layer}
            </button>
          ))}
        </div>
      </div>
      <div className="absolute top-4 right-4 flex w-8 flex-col overflow-hidden rounded-lg border border-border-default bg-surface-base shadow-sm">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          className="flex size-8 items-center justify-center text-title text-text-secondary hover:bg-surface-raised"
        >
          +
        </button>
        <span className="h-px bg-border-subtle" />
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          className="flex size-8 items-center justify-center text-title text-text-secondary hover:bg-surface-raised"
        >
          −
        </button>
        <span className="h-px bg-border-subtle" />
        <button type="button" aria-label="Reset view" onClick={reset} className="flex size-8 items-center justify-center hover:bg-surface-raised">
          <Icon name="app/icon-map-pin-secondary-16" size={16} />
        </button>
      </div>
      <p className="pointer-events-none absolute top-[88px] right-14 text-caption text-text-tertiary">Drag to move · scroll or +/− to zoom</p>
      <p className="pointer-events-none absolute right-4 bottom-3 text-caption text-text-tertiary">
        {level === "country" ? "16 regions" : level === "ashanti" ? "43 districts" : "14 districts"} · boundaries 2019
      </p>

      <div className="absolute bottom-3 left-3 flex w-[230px] flex-col gap-1.5 rounded-lg border border-border-default bg-surface-base px-3 py-2.5 shadow-sm">
        <p className="text-caption font-medium text-text-primary">{legendTitle}</p>
        <div className="flex gap-0.5">
          {BUCKETS.map((c) => (
            <span key={c} className="h-2 flex-1 first:rounded-l-[3px] last:rounded-r-[3px]" style={{ background: c }} />
          ))}
        </div>
        <div className="flex">
          {geo.legend.map((l) => (
            <span key={l} className="flex-1 text-[11px] text-text-tertiary">
              {l}
            </span>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className={cn("size-2.5 rounded-full", level === "ashanti" ? "border-[1.5px] border-surface-inverse" : "bg-surface-inverse")} />
          {level === "country" ? "Hotspot town · size = alerts" : level === "ashanti" ? "Town · ring size = alerts" : "Neighbourhood · size = alerts"}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="size-2.5 rounded-full border-2 border-critical-solid" />
          Red ring · the hotspot to act on
        </p>
        {level === "kumasi" && (
          <p className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="size-2.5 rounded-[3px] bg-chart-1" />
            Mobile money agent
          </p>
        )}
      </div>
    </div>
  );
}
