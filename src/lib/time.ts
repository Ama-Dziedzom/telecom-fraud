"use client";

import { useEffect, useState } from "react";

/**
 * The app clock. NEXT_PUBLIC_FD_DEMO_NOW pins it for the Postman mock, whose
 * data is fixed in time; real deployments leave it empty and use the clock.
 */
const DEMO_NOW = process.env.NEXT_PUBLIC_FD_DEMO_NOW;

/** Operators work in Ghana time, whatever the browser’s zone. */
export const TZ = "Africa/Accra";
const dayOf = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const demoOffset = DEMO_NOW ? Date.parse(DEMO_NOW) - Date.now() : 0;

export function now() {
  return Date.now() + demoOffset;
}

/** Re-renders every `intervalMs` with the current app time. */
export function useNow(intervalMs = 30_000) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}

/** 1h 40m · 18m · 45s */
export function formatSpan(ms: number) {
  const s = Math.max(0, Math.round(Math.abs(ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/** just now · 2m ago · 3h ago · Yesterday · 18 Oct */
export function formatAgo(iso: string, at: number) {
  const diff = at - Date.parse(iso);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000 && dayOf(iso) === dayOf(at)) {
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
  if (diff < 2 * 86_400_000) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
}

/** 09:58 */
export function formatClock(t: string | number) {
  return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

/** Today 09:41 · Yesterday · 18 Oct · Jul 2024 — for activity timelines. */
export function formatWhen(iso: string, at: number, { withTime = false } = {}) {
  if (dayOf(iso) === dayOf(at)) return withTime ? `Today ${formatClock(iso)}` : formatClock(iso);
  if (dayOf(Date.parse(iso) + 86_400_000) === dayOf(at)) return "Yesterday";
  const d = new Date(iso);
  if (at - d.getTime() > 180 * 86_400_000) return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: TZ });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
}

/** 12 Jul 2024 */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

/** 09:12 today, otherwise “Yesterday” / “18 Oct”. */
export function formatClockOrDay(iso: string, at: number) {
  if (dayOf(iso) === dayOf(at)) return formatClock(iso);
  return formatAgo(iso, at);
}

export function greeting(at: number) {
  const h = Number(new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Tue 20 Oct */
export function formatDay(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}

export function formatMoney(amountMinor: number, currency: string, { decimals = false } = {}) {
  const value = (amountMinor / 100).toLocaleString("en-GB", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `${currency} ${value}`;
}
