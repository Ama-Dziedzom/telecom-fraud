"use client";

import { useEffect, useRef } from "react";
import type { Box, Level } from "./geo";

/** A source of heat in map px: where it is, how far it spreads and how strong it is (0–1). */
type Spot = { x: number; y: number; r: number; w: number };

const H = 640;
/** Canvas px per map px, so the field stays smooth when zoomed in. */
const K = 2;

/** CSS `inset` (1–4 percentages) → the box the image actually covers. */
function bleed(b: Box & { inset: string }) {
  const v = b.inset.split(/\s+/).map((s) => parseFloat(s) / 100);
  const [t, r, bt, l] = v.length === 1 ? [v[0], v[0], v[0], v[0]] : v.length === 2 ? [v[0], v[1], v[0], v[1]] : v.length === 3 ? [v[0], v[1], v[2], v[1]] : v;
  return { x: b.x + l * b.w, y: b.y + t * b.h, w: b.w * (1 - l - r), h: b.h * (1 - t - bt) };
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** 256 colours along the sequential ramp; alpha rises with density so the low end fades into the land. */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 0);
  ["seq-1", "seq-2", "seq-3", "seq-4", "seq-5"].forEach((t, i) => grad.addColorStop(i / 4, css.getPropertyValue(`--color-${t}`).trim()));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 1);
  const px = g.getImageData(0, 0, 256, 1).data;
  for (let i = 0; i < 256; i++) px[i * 4 + 3] = Math.round(Math.min(1, (i / 255) * 1.8) * 235);
  return px;
}

/**
 * The density field under the pins: each hotspot and each area’s centre adds a soft
 * blob, the sum is coloured with the blue ramp and clipped to the land.
 */
export function HeatField({ geo, spots }: { geo: Level; spots: Spot[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(spots);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let live = true;
    const w = geo.width * K;
    const h = H * K;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, h);

    // 1 · Density as alpha: overlapping blobs build up towards 1.
    for (const s of spots) {
      const g = ctx.createRadialGradient(s.x * K, s.y * K, 0, s.x * K, s.y * K, s.r * K);
      g.addColorStop(0, `rgba(0,0,0,${s.w})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect((s.x - s.r) * K, (s.y - s.r) * K, s.r * 2 * K, s.r * 2 * K);
    }

    // 2 · Alpha → colour.
    const ramp = palette(canvas);
    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    for (let i = 3; i < px.length; i += 4) {
      const a = px[i];
      if (!a) continue;
      px[i - 3] = ramp[a * 4];
      px[i - 2] = ramp[a * 4 + 1];
      px[i - 1] = ramp[a * 4 + 2];
      px[i] = ramp[a * 4 + 3];
    }
    ctx.putImageData(img, 0, 0);

    // 3 · Keep it on land: the union of the boundaries (or the flattened districts).
    const land = geo.shapes.length ? geo.shapes : geo.base.filter((b) => b.land);
    if (!land.length) return;
    void Promise.all(land.map((b) => load(b.src).then((im) => ({ im, at: bleed(b) })))).then((imgs) => {
      if (!live) return;
      const mask = document.createElement("canvas");
      mask.width = w;
      mask.height = h;
      const m = mask.getContext("2d")!;
      for (const { im, at } of imgs) m.drawImage(im, at.x * K, at.y * K, at.w * K, at.h * K);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    });
    return () => {
      live = false;
    };
    // `key` stands in for `spots`, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, key]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute top-0 left-0 mix-blend-multiply" style={{ width: geo.width, height: H }} />;
}
