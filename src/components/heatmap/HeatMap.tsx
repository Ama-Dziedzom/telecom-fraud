"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";
import { BUCKETS, LEVELS, type Level, type Pin } from "./geo";

export type Layers = {
  shapes: Record<string, number>;
  pins: Array<{ id: string; name: string; value: number }>;
  agents?: Array<{ id: string; hot: boolean }>;
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

/** G21–G25 · The map canvas: boundaries coloured by bucket, hotspots with labels, zoom and drag. */
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
  const on = (layer: string) => visible[layer] !== false;
  const scale = fit * zoom;
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      ref={box}
      className="relative h-[640px] min-w-0 flex-1 touch-none overflow-hidden rounded-xl border border-border-subtle bg-[#eef0f6] select-none"
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
              const bucket = layers.shapes[s.id] ?? 0;
              const focused = focus === s.id;
              return (
                <div key={s.id} className="absolute" style={{ left: s.x, top: s.y, width: s.w, height: s.h }} title={`${s.name}: ${bucket ? geo.legend[bucket] : "no"} alerts`}>
                  <span
                    aria-hidden
                    className="absolute block"
                    style={{
                      inset: s.inset,
                      background: focused ? "#E9E6FA" : BUCKETS[bucket],
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
                      className={cn("block size-full max-w-none", focused && "[filter:drop-shadow(0_0_1px_#5347CE)_drop-shadow(0_0_1px_#5347CE)]")}
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
              <span key={p.name + p.x} className="absolute text-overline whitespace-nowrap text-text-tertiary uppercase opacity-80" style={{ left: p.x, top: p.y, letterSpacing: "1.4px" }}>
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
              const hot = layers.agents?.find((x) => x.id === a.id)?.hot;
              return (
                <span
                  key={a.id}
                  title={a.id}
                  className="absolute flex size-5 items-center justify-center rounded-[6px] border-2 border-white"
                  style={{ left: a.x, top: a.y, background: hot ? "#c2410c" : "#a8a5bd" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src="/figma/map/agent-building.svg" className="size-[11px]" />
                </span>
              );
            })}

          {on(geo.layers[1]) && (
            <>
              <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={geo.width} height={H}>
                {geo.pins.map((pin) => {
                  const p = pins.get(pin.id);
                  if (!p) return null;
                  const l = leader(pin, p.name, p.value);
                  return <line key={pin.id} x1={l.cx} y1={l.cy} x2={l.tx} y2={l.ty} stroke="#1D1948" strokeWidth={1} />;
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
                      aria-label={`${p.name}: ${p.value} alerts${pin.drill ? ", zoom in" : ""}`}
                      onClick={() => (pin.drill ? onDrill(pin.drill) : onPin(pin.id))}
                      className={cn(
                        "absolute flex items-center justify-center rounded-full text-caption font-medium text-text-inverse",
                        ring ? "border-[1.5px] border-[#1D1948] bg-white/40" : "border-2 border-white bg-[#1D1948] shadow-sm",
                      )}
                      style={{ left: pin.x, top: pin.y, width: pin.size, height: pin.size }}
                    >
                      {ring ? <span className="size-1.5 rounded-full bg-[#1D1948]" /> : pin.size >= 24 ? p.value : null}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => (pin.drill ? onDrill(pin.drill) : onPin(pin.id))}
                      className="absolute flex items-center gap-1.5 rounded-md bg-surface-base px-2 py-1 text-caption font-medium whitespace-nowrap text-text-primary shadow-sm"
                      style={{ left: pin.label[0], top: pin.label[1] }}
                    >
                      {p.name}
                      <span className="font-mono text-mono-s text-critical-fg">{p.value}</span>
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
        <div className="flex w-fit gap-0.5 rounded-[10px] border border-border-subtle bg-surface-base p-1 shadow-sm">
          {geo.layers.map((layer, i) => (
            <button
              key={layer}
              type="button"
              aria-pressed={on(layer)}
              onClick={() => setVisible((v) => ({ ...v, [layer]: !on(layer) }))}
              className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-caption font-medium", on(layer) ? "bg-surface-sunken text-text-primary" : "text-text-tertiary")}
            >
              <span className={cn("size-2.5", i === 0 ? "rounded-[3px] bg-[#E57E6C]" : i === 1 ? "rounded-full bg-[#1D1948]" : "rounded-[3px] bg-[#c2410c]")} />
              {layer}
            </button>
          ))}
        </div>
      </div>
      <div className="absolute top-4 right-4 flex w-8 flex-col overflow-hidden rounded-[10px] border border-border-subtle bg-surface-base shadow-sm">
        <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))} className="flex size-8 items-center justify-center text-title text-text-secondary hover:bg-surface-raised">
          +
        </button>
        <span className="h-px bg-border-subtle" />
        <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} className="flex size-8 items-center justify-center text-title text-text-secondary hover:bg-surface-raised">
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

      <div className="absolute bottom-3 left-3 flex w-[230px] flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-base px-3 py-2.5 shadow-sm">
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
          <span className={cn("size-2.5 rounded-full", level === "ashanti" ? "border-[1.5px] border-[#1D1948]" : "bg-[#1D1948]")} />
          {level === "country" ? "Hotspot town · size = alerts" : level === "ashanti" ? "Town · ring size = alerts" : "Neighbourhood · size = alerts"}
        </p>
        {level === "kumasi" && (
          <p className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="size-2.5 rounded-[3px] bg-[#c2410c]" />
            Mobile money agent
          </p>
        )}
      </div>
    </div>
  );
}
