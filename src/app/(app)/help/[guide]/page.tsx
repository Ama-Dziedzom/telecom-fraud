"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { GuideRow } from "@/components/help/GuideRow";
import type { Help } from "@/components/shell/ShellDialogs";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useApi } from "@/lib/api/fd";
import { findGuide, guideLength, type GuideBlock } from "@/lib/help/guides";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="text-body-m text-text-primary">{block.text}</p>;
    case "keys":
      return (
        <p className="flex items-center gap-2 text-caption text-text-secondary">
          {block.keys.map((k) => (
            <kbd key={k} className="flex h-6 min-w-6 items-center justify-center rounded border border-border-default bg-surface-raised px-1.5 font-sans text-caption font-medium text-text-primary">
              {k}
            </kbd>
          ))}
          <span className="ml-0.5">{block.label}</span>
        </p>
      );
    case "tip":
      return (
        <Banner tone="info" title={block.title}>
          {block.text}
        </Banner>
      );
    case "rows":
      return (
        <dl className="flex flex-col">
          {block.rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6 border-b border-border-default py-2.5 last:border-b-0">
              <dt className="shrink-0 text-body-s text-text-secondary">{k}</dt>
              <dd className="text-right text-body-s text-text-primary">{v}</dd>
            </div>
          ))}
        </dl>
      );
  }
}

/** The section in view, for “On this page”. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (!ids.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/**
 * I20 · Guide — the guide text with numbered sections, “On this page”,
 * related guides and “Was this helpful?”. Guides without written text say so
 * and point to the help site when GET /help has a link for them.
 */
export default function GuidePage() {
  const { guide: id } = useParams<{ guide: string }>();
  const guide = findGuide(id);
  const { data: help } = useApi<Help>(guide && !guide.sections ? "/help" : null);
  const sectionIds = guide?.sections?.map((s) => s.id) ?? [];
  const [ids] = useState(sectionIds);
  const active = useActiveSection(ids);
  const [copied, setCopied] = useState(false);
  const [helpful, setHelpful] = useState<"yes" | "no" | null>(null);

  if (!guide) {
    return (
      <>
        <AppHeader section="Help" title="Guide not found" />
        <PageBody>
          <EmptyState
            icon="app/icon-file-secondary-18"
            title="We can’t find that guide"
            actions={<ButtonLink href="/help" size="md">Back to the help centre</ButtonLink>}
            className="min-h-[300px]"
          >
            It may have moved. Search the help centre instead.
          </EmptyState>
        </PageBody>
      </>
    );
  }

  const externalUrl = guide.apiId ? help?.guides.find((g) => g.id === guide.apiId)?.url : null;
  const meta = [guide.minutes ? `${guide.minutes} min read` : "Step by step", guide.updated && `updated ${formatDate(guide.updated)}`, "for fraud analysts"].filter(Boolean).join(" · ");
  const related = (guide.related ?? []).map(findGuide).filter((g) => g !== undefined);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <AppHeader section="Help" title={guide.title} />
      <PageBody>
        <PageHead
          title={guide.title}
          pill={<Badge label={guide.group.title} tone="neutral" size="md" />}
          subtitle={meta}
          actions={
            <Button variant="secondary" size="md" onClick={copyLink}>
              {copied ? "Link copied" : "Copy link"}
            </Button>
          }
        />

        <div className="flex items-start gap-6">
          <article className="flex min-w-0 flex-1 flex-col gap-5 rounded-lg border border-border-default bg-surface-base px-6 pt-5 pb-5">
            {guide.sections ? (
              <>
                {guide.intro && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-title text-text-primary">{guide.intro.title}</h3>
                    <p className="text-body-m text-text-primary">{guide.intro.text}</p>
                  </div>
                )}
                {guide.sections.map((s, i) => (
                  <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-4">
                    <h3 className="text-title text-text-primary">
                      {i + 1}. {s.title}
                    </h3>
                    {s.blocks.map((b, j) => (
                      <Block key={j} block={b} />
                    ))}
                  </section>
                ))}
                <div className="flex items-center justify-between gap-4 border-t border-border-default pt-4">
                  {helpful ? (
                    <p className="text-body-s text-text-secondary" role="status">
                      {helpful === "yes" ? "Thanks, glad it helped." : "Thanks for telling us. Send feedback if something was missing."}
                    </p>
                  ) : (
                    <>
                      <p className="text-label-s text-text-primary">Was this helpful?</p>
                      {/* TODO(api): no endpoint records guide feedback yet; this only thanks the reader. */}
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setHelpful("yes")}>
                          Yes
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setHelpful("no")}>
                          No
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                bare
                icon="app/icon-file-secondary-18"
                title="This guide isn’t written yet"
                actions={
                  externalUrl ? (
                    <ButtonLink href={externalUrl} target="_blank" rel="noreferrer" variant="secondary" size="md">
                      Open on the help site
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/help" variant="secondary" size="md">
                      Back to the help centre
                    </ButtonLink>
                  )
                }
              >
                {guide.detail}. Until it’s here, ask your supervisor or the fraud desk on-call.
              </EmptyState>
            )}
          </article>

          {(guide.sections || related.length > 0) && (
            <div className="flex w-[280px] shrink-0 flex-col gap-6">
              {guide.sections && (
                <Card title="On this page">
                  <ol className="flex flex-col gap-2">
                    {guide.sections.map((s, i) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          aria-current={active === s.id ? "location" : undefined}
                          className={cn("rounded text-body-s hover:text-text-brand", active === s.id ? "text-text-brand" : "text-text-secondary")}
                        >
                          {i + 1}. {s.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
              {related.length > 0 && (
                <Card title="Related guides">
                  <div className="flex flex-col">
                    {related.map((r) => (
                      <GuideRow key={r.id} href={`/help/${r.id}`} icon={r.icon} title={r.group.id === "playbooks" ? `${r.title} playbook` : r.title} detail={guideLength(r)} />
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}
