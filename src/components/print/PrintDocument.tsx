"use client";

import { OperatorLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useApi } from "@/lib/api/fd";
import type { User } from "@/lib/auth/api";
import { useOperatorName } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatClock, formatDate, useNow } from "@/lib/time";
import { useEffect, type ReactNode } from "react";

/** 20 Oct 2026, 09:25 */
export const formatStamp = (t: string | number) => `${formatDate(new Date(t).toISOString())}, ${formatClock(t)}`;

/** CSS string literal for `content:` in the page margins. */
const cssString = (s: string) => `"${s.replace(/["\\]/g, "\\$&")}"`;

/**
 * An exported PDF. On screen: a toolbar and an A4 sheet to check before
 * downloading. In print (Download PDF → Save as PDF): only the content, paged
 * by the browser, with the reference and page numbers in the page margins and
 * the viewer’s watermark repeated on every page.
 */
export function PrintDocument({
  kind,
  reference,
  fileName,
  ready,
  children,
}: {
  /** “Case report” — the document’s name. */
  kind: string;
  /** What it is about: “FD-3050”. */
  reference: string;
  /** Without “.pdf”; the browser offers it as the file name. */
  fileName: string;
  /** Data loaded: until then Download PDF waits. */
  ready: boolean;
  children: (stamp: { by: string; at: number; operator: string }) => ReactNode;
}) {
  const { data: me } = useApi<User>("/me");
  const operator = useOperatorName() ?? "MTN Ghana";
  const at = useNow(3_600_000);
  const by = me?.name ?? "";
  const mark = `${by} · ${formatStamp(at)} · ${operator}`;

  useEffect(() => {
    document.title = fileName;
  }, [fileName]);

  return (
    <div className="min-h-screen bg-surface-sunken print:bg-transparent">
      <style>{`@page {
  size: A4;
  margin: 16mm 16mm 18mm;
  @top-right { content: ${cssString(`${reference} · ${kind}`)}; font: 500 8pt var(--font-sans); color: #64748b; }
  @bottom-left { content: ${cssString(`Confidential · numbers masked · exported by ${by}, ${formatStamp(at)}`)}; font: 8pt var(--font-sans); color: #64748b; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 500 8pt var(--font-sans); color: #64748b; }
}`}</style>

      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border-default bg-surface-base px-4 print:hidden">
        <Button variant="secondary" size="sm" onClick={() => (history.length > 1 ? history.back() : window.close())} iconLeft={<Icon name="app/icon-chevron-left-16" size={16} />}>
          Back
        </Button>
        <span className="flex size-8 items-center justify-center rounded-md bg-brand-primary-subtle">
          <Icon name="app/icon-file-secondary-18" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-m text-text-primary">{fileName}.pdf</p>
          <p className="text-caption text-text-secondary">A4 · numbers masked · watermarked with your name</p>
        </div>
        <Button size="sm" disabled={!ready || !by} onClick={() => window.print()} iconLeft={<Icon name="app/icon-download-white-18" size={16} />}>
          Download PDF
        </Button>
      </header>

      <main className="py-8 print:p-0">
        <article
          aria-busy={!ready}
          className="relative mx-auto w-[210mm] overflow-hidden bg-surface-base px-[16mm] py-[14mm] text-body-s text-text-primary shadow-md [print-color-adjust:exact] print:w-auto print:overflow-visible print:p-0 print:shadow-none"
        >
          <Watermark text={mark} />
          <div className="relative">{ready && by ? children({ by, at, operator }) : <p className="py-24 text-center text-text-secondary">Getting the {kind.toLowerCase()} ready…</p>}</div>
        </article>
      </main>
    </div>
  );
}

/** Who exported it and when, across the page; fixed in print so every page carries it. */
function Watermark({ text }: { text: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden print:fixed">
      <div className="absolute -inset-1/2 flex -rotate-30 flex-col justify-center gap-24">
        {Array.from({ length: 14 }, (_, i) => (
          <p key={i} className={cn("text-label-s whitespace-nowrap text-text-primary/[0.07]", i % 2 === 1 && "pl-40")}>
            {Array.from({ length: 4 }, () => text).join("      ")}
          </p>
        ))}
      </div>
    </div>
  );
}

/** First-page masthead: operator, document name and reference, who exported it. */
export function DocHeader({ kind, reference, operator, by, at, form }: { kind: string; reference: string; operator: string; by: string; at: number; form: string }) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <OperatorLogo operator={operator} />
          <p className="pl-10 text-caption text-text-secondary">Fraud operations · FraudDetection</p>
        </div>
        <div className="text-right">
          <p className="text-overline text-text-tertiary uppercase">{kind}</p>
          <p className="text-h2 text-text-primary">{reference}</p>
          <p className="font-mono text-[10px] leading-4 text-text-tertiary">{form}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-y-2 border-text-primary py-1.5 font-mono text-[11px] leading-4 text-text-secondary">
        <span>Exported by {by}</span>
        <span>{formatStamp(at)} Africa/Accra</span>
      </div>
    </header>
  );
}

/** A lettered section: grey bar, then its content. The bar never ends a page. */
export function Section({ letter, title, aside, children, className }: { letter: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h2 className="flex items-center justify-between rounded-sm bg-surface-sunken px-2 py-1 text-overline text-text-secondary uppercase break-after-avoid">
        <span>
          {letter} · {title}
        </span>
        {aside && <span className="font-medium tracking-normal normal-case">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Label and value, as on a form. */
export function Field({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="grid grid-cols-[38mm_1fr] gap-3 border-b border-border-subtle py-1.5 break-inside-avoid last:border-b-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-label-s text-text-primary">
        {children}
        {sub && <span className="block text-caption font-normal text-text-secondary">{sub}</span>}
      </dd>
    </div>
  );
}

/** Tables in a document: small type, ruled rows, headers repeat on each page. */
export const doc = {
  table: "w-full border-collapse text-caption",
  th: "border-b border-text-primary py-1 pr-3 text-left text-overline font-bold text-text-secondary uppercase last:pr-0",
  tr: "break-inside-avoid border-b border-border-subtle align-top",
  td: "py-1.5 pr-3 last:pr-0",
  num: "text-right tabular-nums",
  mono: "font-mono text-[11px] leading-4",
};
