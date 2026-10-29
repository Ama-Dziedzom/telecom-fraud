"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead, useShell } from "@/components/app/AppShell";
import { Card, CardMeta } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { GuideRow } from "@/components/help/GuideRow";
import { contactDetail, HELP_ICON, KIND_ICON, SystemStatus, type Help } from "@/components/shell/ShellDialogs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useApi } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
import { HELP_GROUPS, type Guide } from "@/lib/help/guides";
import { useState } from "react";

const detailLine = (g: Guide) => (g.minutes ? `${g.detail} · ${g.minutes} min` : g.detail);

/**
 * I19 · Help centre — guides grouped by the work, system status and who to
 * contact. Contacts and status come from the API; the guides are the app’s
 * own content (src/lib/help/guides.ts). “Most read this week” and “What’s new”
 * are left out until the API reports reads and release notes.
 */
export default function HelpCentrePage() {
  // Same fallback as the sidebar’s workspace row.
  const operator = useOperatorName() ?? "MTN Ghana";
  const shell = useShell();
  const { data: help } = useApi<Help>("/help");
  const [q, setQ] = useState("");
  const match = (g: Guide) => !q.trim() || `${g.title} ${g.detail}`.toLowerCase().includes(q.trim().toLowerCase());
  const groups = HELP_GROUPS.map((g) => ({ ...g, shown: g.guides.filter(match) })).filter((g) => g.shown.length > 0);

  return (
    <>
      <AppHeader section="Help" title="Help centre" />
      <PageBody>
        <PageHead title="Help centre" subtitle={`Guides for fraud analysts at ${operator} · updated weekly`} />

        <label className="flex h-11 items-center gap-2.5 rounded-lg border border-border-strong bg-surface-base px-3.5 focus-within:border-[1.5px] focus-within:border-border-focus focus-within:shadow-focus">
          <Icon name="app/icon-search" size={16} />
          <input
            type="search"
            aria-label="Search guides"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guides, e.g. reversal limits"
            className="min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
          />
        </label>

        <div className="flex items-start gap-6">
          {groups.length ? (
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-6">
              {groups.map((g) => (
                <Card key={g.id} id={g.id} title={g.title} aside={<CardMeta>{`${g.guides.length} ${g.unit}`}</CardMeta>} className="scroll-mt-6">
                  <div className="flex flex-col">
                    {g.shown.map((guide) => (
                      <GuideRow key={guide.id} href={`/help/${guide.id}`} icon={guide.icon} title={guide.title} detail={detailLine(guide)} />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="app/icon-search"
              title={`No guides match “${q.trim()}”`}
              actions={
                <Button variant="secondary" size="md" onClick={() => setQ("")}>
                  Clear search
                </Button>
              }
              className="min-w-0 flex-1"
            >
              Try a shorter word, or ask the fraud desk on-call.
            </EmptyState>
          )}

          <div className="flex w-[314px] shrink-0 flex-col gap-6">
            <Card title="System status">
              <SystemStatus />
            </Card>
            {help && (
              <Card title="Get a person">
                <div className="flex flex-col">
                  {help.contacts.map((c) => (
                    <GuideRow
                      key={c.id}
                      icon={HELP_ICON[c.id] ?? KIND_ICON[c.kind]}
                      title={c.title}
                      detail={contactDetail(c)}
                      href={c.kind === "phone" && c.value ? `tel:${c.value.replace(/\s/g, "")}` : (c.value ?? undefined)}
                      onClick={c.kind === "feedback" ? () => shell.open("feedback") : undefined}
                    />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
