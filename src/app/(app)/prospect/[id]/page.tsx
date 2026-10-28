"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api/client";
import { RequestError } from "@/components/auth/RequestError";
import { ruleChart, ruleText, type ProspectRule } from "@/components/cases/CaseModals";
import { TextArea } from "@/components/ui/TextField";
import { useApi, type PersonRef, type Severity } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { TooltipBubble, tooltipOnHover } from "@/components/ui/Tooltip";
import { formatAgo, formatDate, useNow } from "@/lib/time";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

type Flag = { kind: string; case_id?: string; count?: number };
type Match = {
  id: string;
  name: string;
  /** Date the agent started trading. */
  agent_since: string;
  today: number;
  severity: Severity;
  by_day: Array<{ date: string; count: number }>;
  /** Engine text. */
  summary: string;
  flags: Flag[];
};
type Prospect = {
  id: string;
  title: string;
  hunch: string;
  owner: PersonRef;
  started_at: string;
  status: string;
  look_at: string;
  rule: ProspectRule;
  matches_count: number;
  matches: Match[];
  normal_max: number;
  verdict: { id: string; title: string; detail: string } | null;
};
type Promoted = {
  case: { id: string; stage: string; status: string; assignee: PersonRef };
  evidence_ids: string[];
  linked_cases: string[];
  remaining_matches: number;
};

/** Match flags → the tags under each card. */
function flagTag(f: Flag): { label: string; tone: BadgeTone } {
  switch (f.kind) {
    case "linked_case":
      return { label: `Linked to ${f.case_id}`, tone: "critical" };
    case "paid_confirmed_mules":
      return {
        label: `${f.count} confirmed ${f.count === 1 ? "mule" : "mules"} paid`,
        tone: "high",
      };
    case "no_links":
      return { label: "No links", tone: "neutral" };
    case "likely_promo":
      return { label: "Likely promo", tone: "neutral" };
    default:
      return { label: f.kind.replace(/_/g, " "), tone: "neutral" };
  }
}

/** 14-day swap chart. Days over the normal line are red only on the match worth a case (the API marks it critical). */
function SwapChart({ match, normalMax }: { match: Match; normalMax: number }) {
  const max = 16;
  const hot = match.severity === "critical";
  return (
    <div className="flex flex-col gap-1" role="img" aria-label={`SIM swaps a day over ${match.by_day.length} days, ${match.today} today`}>
      <div className="relative h-[88px] pl-5">
        {[0, 8, 16].map((v) => (
          <span key={v} className="absolute -translate-y-1/2 text-caption text-text-tertiary" style={{ left: 0, top: `${100 - (v / max) * 100}%` }}>
            {v}
          </span>
        ))}
        {/* Grey band: what a normal agent does. */}
        <span aria-hidden className="absolute right-0 bottom-0 left-5 bg-surface-sunken" style={{ height: `${(normalMax / max) * 100}%` }} />
        <div className="relative flex h-full items-end gap-1 border-b border-border-default">
          {match.by_day.map((d) => (
            <span
              key={d.date}
              className={cn("group/tip relative flex-1 rounded-t-[2px]", hot && d.count > normalMax ? "bg-critical-solid" : "bg-border-strong")}
              style={{ height: `${(Math.min(d.count, max) / max) * 100}%` }}
            >
              <TooltipBubble title={formatDate(d.date)} body={`${d.count} ${d.count === 1 ? "alert" : "alerts"}`} className={tooltipOnHover("top")} />
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-5 text-caption text-text-secondary">
        <span>
          {new Date(match.by_day[0].date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** G12/G13 · A prospect — a hunch with what matches it, promoted to a case when it’s worth one. */
export default function ProspectPage() {
  const { id } = useParams<{ id: string }>();
  const prospectId = decodeURIComponent(id).toUpperCase();
  const router = useRouter();
  const now = useNow();
  const { data, error, isLoading } = useApi<Prospect>(`/prospects/${prospectId}`);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [promoted, setPromoted] = useState<(Promoted & { from: string }) | null>(null);
  const [dropping, setDropping] = useState(false);

  // The engine’s verdict is picked to start with; clicking a card adds or removes it.
  const selected = picked ?? new Set(data?.verdict ? [data.verdict.id] : []);
  const toggle = (mid: string) => {
    const next = new Set(selected);
    if (next.has(mid)) next.delete(mid);
    else next.add(mid);
    setPicked(next);
  };
  const ids = Array.from(selected);

  const promote = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const res = await apiFetch<Promoted>("POST", `/prospects/${prospectId}/promote`, { entity_ids: ids });
      setPromoted({ ...res, from: ids.join(", ") });
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  const drop = async (reason: string) => {
    await apiFetch("POST", `/prospects/${prospectId}/drop`, { reason });
    router.push("/cases?layout=board");
  };
  const lookAt = data?.look_at ?? "agents";

  return (
    <>
      <AppHeader section="Cases / Prospects" title={prospectId} />
      <PageBody>
        {error ? (
          <EmptyState
            icon="app/icon-search-brand-20"
            tone="brand"
            title={`We can’t find ${prospectId}`}
            className="min-h-[300px]"
            actions={
              <ButtonLink href="/cases?layout=board" size="md">
                Back to the board
              </ButtonLink>
            }
          >
            It may have been dropped or promoted already.
          </EmptyState>
        ) : isLoading || !data ? (
          <div className="flex flex-col gap-6" aria-busy>
            <Skeleton className="h-7 w-[420px]" />
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[212px] rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <PageHead
              title={data.hunch}
              pill={<Badge label="Prospect" tone="neutral" size="md" />}
              subtitle={`${data.id} · started by ${data.owner.name} ${formatAgo(data.started_at, now)} · ${ruleText(data.rule)}`}
              actions={
                <>
                  <Button variant="secondary" size="md" onClick={() => setDropping(true)}>
                    Drop prospect
                  </Button>
                  <Button size="md" disabled={!ids.length} loading={busy} onClick={promote}>
                    Promote {ids.length === 1 ? ids[0] : `${ids.length || ""} ${lookAt}`.trim()} to a case
                  </Button>
                </>
              }
            />

            {data.verdict && (
              <Banner tone="warning" title={data.verdict.title} icon="app/icon-alert-triangle-medium-16">
                {data.verdict.detail}
              </Banner>
            )}
            <RequestError error={failure} />

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-4">
                {data.matches.map((m) => {
                  const on = selected.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(m.id)}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border bg-surface-base px-5 pt-4 pb-4 text-left",
                        on ? "border-brand-primary shadow-focus" : "border-border-default hover:border-border-strong",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-title text-text-primary">{m.id}</span>
                        <span className="truncate text-caption text-text-tertiary">
                          {m.name} · agent since {m.agent_since.slice(0, 4)}
                        </span>
                      </span>
                      <SwapChart match={m} normalMax={data.normal_max} />
                      <span className="text-body-s text-text-primary">{m.summary}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {m.flags.map(flagTag).map((t) => (
                          <Badge key={t.label} label={t.label} tone={t.tone} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-caption text-text-secondary">Grey band: a normal agent, up to {data.normal_max} swaps a day</p>
            </div>
          </>
        )}
      </PageBody>

      {promoted && (
        <Modal
          open
          onClose={() => setPromoted(null)}
          width={420}
          title={`${promoted.from} is now case ${promoted.case.id}`}
          description="Moved to Investigate and assigned to you. First response due in 4 hours."
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => setPromoted(null)}>
                Stay on prospect
              </Button>
              <ButtonLink href={`/cases/${promoted.case.id}`} size="md">
                Open {promoted.case.id}
              </ButtonLink>
            </>
          }
        >
          <div className="flex flex-col gap-2.5 rounded-lg border border-border-default bg-surface-raised px-3.5 py-3">
            <p className="text-body-s text-text-secondary">Brought across</p>
            {["Your hunch and rule", ...(data ? [`${ruleChart(data.rule)}, as evidence`] : []), ...promoted.linked_cases.map((c) => `Link to ${c}`)].map((b) => (
              <p key={b} className="flex items-center gap-2.5 text-body-s text-text-primary">
                <Icon name="app/icon-check-secondary-18" size={14} />
                {b}
              </p>
            ))}
          </div>
          {promoted.remaining_matches > 0 && (
            <p className="flex items-center gap-2.5 rounded-lg border border-info-border bg-info-bg px-4 py-3 text-body-s text-info-fg">
              <Icon name="app/icon-info-info-20" size={16} />
              {prospectId} stays open with the other {promoted.remaining_matches} {promoted.remaining_matches === 1 ? lookAt.replace(/s$/, "") : lookAt}
            </p>
          )}
        </Modal>
      )}
      {dropping && <DropModal prospectId={prospectId} onDrop={drop} onClose={() => setDropping(false)} />}
    </>
  );
}

/** Drop a prospect — the reason is kept with it. */
function DropModal({ prospectId, onDrop, onClose }: { prospectId: string; onDrop: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const drop = async () => {
    setBusy(true);
    try {
      await onDrop(reason.trim());
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={500}
      title={`Drop ${prospectId}?`}
      description="It leaves the board. Nothing changes for customers."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={drop} loading={busy} disabled={!reason.trim()}>
            Drop prospect
          </Button>
        </>
      }
    >
      <TextArea label="Why drop it?" required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wallets were a payroll batch." />
      <RequestError error={failure} />
    </Modal>
  );
}
