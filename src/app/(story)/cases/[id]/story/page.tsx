"use client";

import { ChapterVisual, type Visual } from "@/components/story/ChapterVisual";
import { StoryExport } from "@/components/story/StoryExport";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api/client";
import { useCase } from "@/lib/api/cases";
import { useApi } from "@/lib/api/fd";
import type { User } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatClock, useNow } from "@/lib/time";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Chapter = {
  number: number;
  at: string | null;
  short: string;
  title: string;
  summary: string;
  stats: Array<[string, string, string?]>;
  visual: Visual;
};
type Brief =
  | { status: "building"; events_found: number; chapters_ready: number; chapters_total: number }
  | { status: "ready"; outcome: string; chapters: Chapter[] };

const STAT_TONE: Record<string, string> = { high: "text-[#f4a77c]", critical: "text-[#f2a3a3]", success: "text-[#9fd8a3]" };
const PLACEHOLDER = ["The SIM swap", "A new phone", "The money moves", "Where it went", "What we did", "Where it stands"];

function Logo() {
  return (
    <span className="flex items-center gap-2.5 rounded-[10px] bg-brand-ink px-2 py-1.5 pr-3">
      <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#6a5ff0_0%,#3e359b_71.4%)]">
        <Icon name="icon-activity" size={18} />
      </span>
      <span className="text-h3">
        <span className="text-shell-text">Fraud</span>
        <span className="text-logo-accent">Detection</span>
      </span>
    </span>
  );
}

const ghost = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-base px-3 text-label-s text-text-primary disabled:opacity-60";

/** E13–E23 · Story mode — the case told in six chapters, for briefings and handovers. */
export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const caseId = decodeURIComponent(id).toUpperCase();
  const router = useRouter();
  const now = useNow();
  const { data: me } = useApi<User>("/me");
  const { data: detail } = useCase(caseId);
  const { data, error } = useApi<Brief>(`/cases/${caseId}/brief?format=json`, {
    refreshInterval: (b) => (b?.status === "building" ? 1200 : 0),
  });
  const [index, setIndex] = useState(0);
  const [exporting, setExporting] = useState<null | "pdf" | "link">(null);

  const chapters = data?.status === "ready" ? data.chapters : [];
  const building = !data || data.status === "building";
  const chapter = chapters[index];
  const last = index === chapters.length - 1;

  // ← → move between chapters; Esc goes back to the case.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (exporting || building) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(chapters.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Escape") router.push(`/cases/${caseId}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapters.length, building, exporting, router, caseId]);

  // E22 · not enough to tell yet.
  if (error instanceof ApiError && error.code === "not_enough_events") {
    const p = error.problem as unknown as { events: number; needed: number; opened_at: string };
    const mins = Math.max(1, Math.round((now - Date.parse(p.opened_at)) / 60_000));
    return (
      <div className="relative flex min-h-dvh items-center justify-center bg-brand-ink-deep p-8">
        <div className="absolute top-8 left-12">
          <Logo />
        </div>
        <div className="flex w-[620px] flex-col items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 px-10 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-surface-raised">
            <Icon name="app/icon-history-18" size={22} />
          </span>
          <h1 className="text-h3 text-text-inverse">Not much of a story yet</h1>
          <p className="max-w-[480px] text-body-m text-[#c9c6e6]">
            {caseId} was opened {mins} minutes ago and has {p.events} {p.events === 1 ? "event" : "events"}. Story mode needs at least {p.needed}. Add notes, evidence or actions and
            come back.
          </p>
          <ButtonLink href={`/cases/${caseId}`} size="md" iconLeft={<Icon name="app/icon-arrow-left-white-16" size={16} />}>
            Back to the case
          </ButtonLink>
        </div>
      </div>
    );
  }

  const labels = chapters.length ? chapters.map((c) => [c.at ? formatClock(c.at) : "Now", c.short]) : PLACEHOLDER.map((s, i) => [["06:34", "08:39", "08:41", "09:03", "09:31", "Now"][i], s]);

  return (
    <div className="flex min-h-dvh flex-col bg-brand-ink-deep px-12 py-8">
      <header className="flex items-center gap-4">
        <Logo />
        <span className="text-body-s text-[#c9c6e6]">{caseId} · Story</span>
        <span className="flex flex-1 justify-center gap-1.5" aria-hidden>
          {labels.map((_, i) => (
            <span key={i} className={cn("h-1 w-16 rounded-full", i <= index && !building ? "bg-brand-highlight" : i === 0 ? "bg-brand-highlight" : "bg-white/15")} />
          ))}
        </span>
        <button type="button" disabled={building} onClick={() => setExporting("pdf")} className={ghost}>
          <Icon name="app/icon-download-18" size={16} />
          Export
        </button>
        <button type="button" disabled={building} onClick={() => setExporting("link")} className={ghost}>
          <Icon name="app/icon-send-18" size={16} />
          Share
        </button>
        <Link href={`/cases/${caseId}`} className="flex items-center gap-1.5 rounded text-label-s text-brand-highlight hover:underline">
          <Icon name="app/icon-x-lilac-18" size={14} />
          Exit story
        </Link>
      </header>

      <main className="flex flex-1 items-center gap-24">
        <section className="flex w-[520px] shrink-0 flex-col gap-4" aria-live="polite">
          <p className="text-overline text-brand-highlight uppercase">
            {building ? `Story mode · ${caseId}` : `Chapter ${chapter.number} of ${chapters.length} · ${chapter.at ? formatClock(chapter.at) : "Now"}`}
          </p>
          <h1 className="text-[40px] leading-[48px] font-bold tracking-[-0.4px] text-text-inverse">{building ? "Building the story…" : chapter.title}</h1>
          <p className="text-body-l text-[#c9c6e6]">
            {building ? `Reading ${data?.status === "building" ? data.events_found : "the"} case events and picking the moments that matter. This takes a few seconds.` : chapter.summary}
          </p>
          <div className="flex gap-2.5">
            {(building
              ? [
                  [String(data?.status === "building" ? data.events_found : "…"), "Events found"],
                  [`${data?.status === "building" ? data.chapters_ready : 0} of ${data?.status === "building" ? data.chapters_total : 6}`, "Chapters ready"],
                ]
              : chapter.stats
            ).map(([value, label, tone]) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className={cn("text-title", tone ? STAT_TONE[tone] : "text-text-inverse")}>{value}</span>
                <span className="text-caption text-[#9893c4]">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 justify-end">
          <div className="flex w-full max-w-[900px] flex-col gap-4 rounded-2xl bg-surface-base px-8 py-7 shadow-lg">
            {building ? (
              <div className="flex flex-col gap-4" aria-busy>
                <div className="flex gap-3">
                  <span className="size-10 animate-pulse rounded-[10px] bg-surface-sunken" />
                  <span className="flex flex-col gap-2">
                    <span className="h-3 w-56 animate-pulse rounded bg-surface-sunken" />
                    <span className="h-3 w-40 animate-pulse rounded bg-surface-sunken" />
                  </span>
                </div>
                <span className="h-[140px] w-full animate-pulse rounded-xl bg-surface-sunken" />
                <span className="h-3 w-2/3 animate-pulse rounded bg-surface-sunken" />
                <span className="h-3 w-1/2 animate-pulse rounded bg-surface-sunken" />
              </div>
            ) : (
              <ChapterVisual key={chapter.number} visual={chapter.visual} />
            )}
          </div>
        </section>
      </main>

      <footer className="flex items-end gap-6">
        <ol className="relative flex flex-1">
          <span aria-hidden className="absolute top-[5px] right-[16%] left-0 h-px bg-white/15" />
          {labels.map(([time, label], i) => {
            const passed = !building && i <= index;
            return (
              <li key={label} className="relative flex flex-1 flex-col gap-1.5">
                {passed && i < index && <span aria-hidden className="absolute top-[5px] left-0 h-px w-full bg-brand-highlight" />}
                <button
                  type="button"
                  disabled={building}
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  className="flex flex-col items-start gap-1.5 rounded text-left"
                >
                  <span className={cn("relative rounded-full", i === index ? "size-3 bg-brand-highlight" : passed ? "size-2.5 bg-brand-highlight" : "size-2.5 bg-white/25")} />
                  <span className={cn("font-mono text-mono-s", i === index ? "text-text-inverse" : "text-[#9893c4]")}>{time}</span>
                  <span className={cn("text-body-s", i === index ? "text-text-inverse" : "text-[#9893c4]")}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            size="md"
            disabled={building || index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            iconLeft={<Icon name="app/icon-arrow-left-18" size={16} />}
          >
            Back
          </Button>
          {last && !building ? (
            <Button size="md" onClick={() => setExporting("pdf")} iconLeft={<Icon name="app/icon-download-white-18" size={16} />}>
              Export as PDF
            </Button>
          ) : (
            <Button size="md" disabled={building} onClick={() => setIndex((i) => i + 1)} iconLeft={<Icon name="app/icon-arrow-right-white-16" size={16} />}>
              Next
            </Button>
          )}
        </div>
      </footer>

      {exporting && detail && (
        <StoryExport caseId={caseId} msisdn={detail.subject.msisdn} author={me?.name ?? "you"} now={now} initialFormat={exporting} onClose={() => setExporting(null)} />
      )}
    </div>
  );
}
