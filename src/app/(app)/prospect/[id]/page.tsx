"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api/client";
import { RequestError } from "@/components/auth/RequestError";
import { ruleChart, ruleText, type ProspectRule } from "@/components/cases/CaseModals";
import { TextArea } from "@/components/ui/TextField";
import { useApi, type PersonRef, type Severity } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatAgo, useNow } from "@/lib/time";
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
      return { label: `${f.count} confirmed ${f.count === 1 ? "mule" : "mules"} paid`, tone: "high" };
    case "no_links":
      return { label: "No links", tone: "neutral" };
    case "likely_promo":
      return { label: "Likely promo", tone: "neutral" };
    default:
      return { label: f.kind.replace(/_/g, " "), tone: "neutral" };
  }
}

const STEPS = ["Prospect", "Investigate", "Decide", "Monitor", "Closed"];

function SwapChart({ match }: { match: Match }) {
  const max = 16;
  const hot = match.severity === "critical";
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-[72px] pl-6">
        {[0, 8, 16].map((v) => (
          <span key={v} className="absolute right-0 left-6 h-px bg-border-subtle" style={{ bottom: `${(v / max) * 100}%` }}>
            <span className="absolute -left-6 -translate-y-1/2 font-mono text-mono-s text-text-tertiary">{v}</span>
          </span>
        ))}
        {/* “Normal” band: up to 3 swaps a day. */}
        <span aria-hidden className="absolute right-0 bottom-0 left-6 bg-success-bg" style={{ height: `${(3 / max) * 100}%` }} />
        <div className="relative flex h-full items-end gap-1">
          {match.by_day.map((d) => (
            <span
              key={d.date}
              title={`${d.date}: ${d.count}`}
              className={cn("flex-1 rounded-t-[2px]", hot ? "bg-critical-fg" : "bg-brand-highlight/60")}
              style={{ height: `${(Math.min(d.count, max) / max) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-6 font-mono text-mono-s text-text-tertiary">
        <span>{new Date(match.by_day[0].date).getDate()} Oct</span>
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
  const [promoted, setPromoted] = useState<(Promoted & { from: string }) | null>(null);
  const [dropping, setDropping] = useState(false);

  const selected = picked ?? new Set(data?.verdict ? [data.verdict.id] : []);
  const toggle = (mid: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(mid);
    else next.delete(mid);
    setPicked(next);
  };

  const promote = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<Promoted>("POST", `/prospects/${prospectId}/promote`, { entity_ids: Array.from(selected) });
      setPromoted({ ...res, from: Array.from(selected).join(", ") });
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
          <EmptyState icon="app/icon-search-brand-20" tone="brand" title={`We can’t find ${prospectId}`} className="min-h-[300px]" actions={<ButtonLink href="/cases?layout=board" size="md">Back to the board</ButtonLink>}>
            It may have been dropped or promoted already.
          </EmptyState>
        ) : isLoading || !data ? (
          <div className="flex flex-col gap-5" aria-busy>
            <Skeleton className="h-7 w-[420px]" />
            <div className="flex gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[180px] flex-1 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <ol className="flex items-center gap-2" aria-label="Stage">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="h-px w-8 bg-border-default" />}
                  <span
                    aria-current={i === 0 ? "step" : undefined}
                    className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-label-s", i === 0 ? "bg-brand-primary text-text-inverse" : "text-text-tertiary")}
                  >
                    <span className={cn("size-2.5 rounded-full border", i === 0 ? "border-white" : "border-text-tertiary")} />
                    {s}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex items-start justify-between gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="flex items-center gap-3 text-h2 text-text-primary">
                  {data.hunch}
                  <Badge label="Prospect" tone="brand" dot />
                </h2>
                <p className="text-body-s text-text-secondary">
                  {data.id} · started by {data.owner.name} {formatAgo(data.started_at, now)} · rule: {ruleText(data.rule)}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Button variant="ghost" size="md" onClick={() => setDropping(true)} iconLeft={<Icon name="app/icon-x-brand-14" size={16} />}>
                  Drop prospect
                </Button>
                <Button size="md" disabled={!selected.size} loading={busy} onClick={promote} iconLeft={<Icon name="app/icon-arrow-right-white-16" size={18} />}>
                  Promote {selected.size} to a case
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {data.matches.map((m) => {
                const on = selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer flex-col gap-3 rounded-xl border bg-surface-base px-4 py-4",
                      on ? "border-[1.5px] border-brand-primary bg-brand-primary-subtle/60" : "border-border-subtle",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Checkbox label={`Select ${m.id}`} hideLabel checked={on} onChange={(e) => toggle(m.id, e.target.checked)} />
                      <span className={cn("flex size-8 items-center justify-center rounded-lg", m.severity === "critical" ? "bg-critical-bg" : "bg-high-bg")}>
                        <Icon name="app/icon-building-high-20" size={16} />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-mono text-mono-m font-semibold text-text-primary">{m.id}</span>
                        <span className="text-caption text-text-secondary">
                          {m.name} · agent since {m.agent_since.slice(0, 4)}
                        </span>
                      </span>
                    </span>
                    <SwapChart match={m} />
                    <span className={cn("text-body-s", m.severity === "critical" ? "text-critical-fg" : "text-text-primary")}>{m.summary}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {m.flags.map(flagTag).map((t) => (
                        <Badge key={t.label} label={t.label} tone={t.tone} />
                      ))}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="flex items-center gap-2 text-caption text-text-secondary">
              <span aria-hidden className="h-2.5 w-4 rounded-sm bg-success-bg" />
              Green band = a normal agent (up to {data.normal_max} swaps a day)
            </p>

            {data.verdict && (
              <section className="flex items-center gap-4 rounded-xl border border-critical-border bg-critical-bg px-5 py-4">
                <span className="flex size-10 items-center justify-center rounded-[10px] bg-surface-base">
                  <Icon name="app/icon-zap-critical-22" size={20} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-title text-critical-fg">{data.verdict.title}</span>
                  <span className="text-body-s text-text-primary">{data.verdict.detail}</span>
                </span>
              </section>
            )}
          </>
        )}
      </PageBody>

      {promoted && (
        <Modal
          open
          onClose={() => setPromoted(null)}
          width={560}
          title={
            <span className="flex items-start gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-success-bg">
                <Icon name="app/icon-check-circle-success-22" size={22} />
              </span>
              <span className="flex flex-col gap-1">
                {promoted.from} is now case {promoted.case.id}
                <span className="text-body-m font-normal text-text-secondary">It moved from Prospect to Investigate and is assigned to you. SLA starts now: first response in 4 hours.</span>
              </span>
            </span>
          }
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => setPromoted(null)}>
                Stay on prospect
              </Button>
              <ButtonLink href={`/cases/${promoted.case.id}`} size="md" iconLeft={<Icon name="app/icon-arrow-right-white-16" size={18} />}>
                Open {promoted.case.id}
              </ButtonLink>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <p className="text-label-s text-text-secondary">Brought across</p>
            {["Your hunch and rule", ...(data ? [`${ruleChart(data.rule)} as evidence`] : []), ...promoted.linked_cases.map((c) => `Link to ${c}`)].map((b) => (
              <p key={b} className="flex items-center gap-2 text-body-m text-text-secondary">
                <Icon name="app/icon-check-success-16" size={16} />
                {b}
              </p>
            ))}
          </div>
          <p className="flex items-center gap-2.5 rounded-[10px] bg-surface-sunken px-3.5 py-3 text-body-s text-text-secondary">
            <Icon name="app/icon-info-secondary-16" size={16} />
            {prospectId} stays open with the other {promoted.remaining_matches} {promoted.remaining_matches === 1 ? lookAt.replace(/s$/, "") : lookAt}.
          </p>
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
