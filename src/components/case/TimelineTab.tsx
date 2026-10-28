"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Card, CardMeta } from "@/components/app/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isProblem, type ApiError } from "@/lib/api/client";
import { ConflictModal } from "./CaseProblem";
import { useColleagues, useTimeline, type Colleague, type TimelineEvent } from "@/lib/api/cases";
import { roleLabel } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen } from "@/lib/time";
import { useId, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { firstName } from "./parts";

type Filter = "all" | "people" | "system" | "notes";

const SOURCE: Record<string, string> = { system: "System", momo: "MoMo", network: "Network", crm: "CRM" };
const isNote = (e: TimelineEvent) => e.kind === "note" || e.kind === "call";
/** “Fraud Supervisor” → “Fraud supervisor”, as the mention list shows roles. */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Dot per event: notes filled, money out red, device and SIM changes amber, the rest hollow. */
function dot(e: TimelineEvent) {
  if (isNote(e)) return "border-text-primary bg-text-primary";
  if (e.kind === "payment") return "border-critical-solid bg-critical-solid";
  if (e.kind === "device" || e.kind === "sim_swap") return "border-medium-solid bg-medium-solid";
  return "border-border-strong bg-surface-base";
}

/** C4/C7 · Timeline — activity on the left, add a note (with @mentions) on the right. */
export function TimelineTab({ caseId, now }: { caseId: string; now: number }) {
  const { data } = useTimeline(caseId);
  const [filter, setFilter] = useState<Filter>("all");
  const events = data?.data ?? [];
  const count = {
    all: events.length,
    people: events.filter((e) => e.source === "person").length,
    system: events.filter((e) => e.source !== "person").length,
    notes: events.filter(isNote).length,
  };
  const shown = events.filter(
    (e) => filter === "all" || (filter === "people" && e.source === "person") || (filter === "system" && e.source !== "person") || (filter === "notes" && isNote(e)),
  );
  const when = (iso: string) => {
    const d = formatWhen(iso, now);
    return d === formatClock(iso) ? d : `${d} ${formatClock(iso)}`;
  };

  return (
    <div className="flex items-start gap-6">
      <Card title="Activity" aside={<CardMeta>Newest first</CardMeta>} className="min-w-0 flex-1">
        <div role="radiogroup" aria-label="Show" className="flex gap-2">
          {(
            [
              ["all", "All"],
              ["people", "People"],
              ["system", "System"],
              ["notes", "Notes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-label-s",
                filter === id ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand" : "border-border-default bg-surface-base text-text-primary hover:bg-surface-raised",
              )}
            >
              {label}
              <span className={cn("text-caption", filter === id ? "text-text-brand" : "text-text-tertiary")}>{count[id]}</span>
            </button>
          ))}
        </div>
        <ol className="flex flex-col">
          {shown.map((e, i) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-14 shrink-0 text-right text-caption text-text-tertiary">{when(e.at)}</span>
              <span aria-hidden className="flex w-3 shrink-0 flex-col items-center gap-1 pt-1">
                <span className={cn("size-2.5 shrink-0 rounded-full border-[1.5px]", dot(e))} />
                {i < shown.length - 1 && <span className="w-px flex-1 bg-border-default" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
                <span className="text-label-s text-text-primary">{e.title}</span>
                <span className="text-body-s text-text-secondary">
                  {[e.source === "person" ? e.actor?.name : (SOURCE[e.source] ?? e.source), e.detail].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <NoteComposer caseId={caseId} />
    </div>
  );
}

/** Add a note — internal or shared with the supervisor; “@” suggests colleagues (C7). */
function NoteComposer({ caseId }: { caseId: string }) {
  const { data: people } = useColleagues();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const areaId = useId();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "supervisor">("internal");
  const [mentions, setMentions] = useState<Colleague[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [active, setActive] = useState(0);
  const [conflict, setConflict] = useState<ApiError | null>(null);

  // The word being typed after an “@”, if any.
  const query = useMemo(() => body.match(/@([\w-]*)$/)?.[1] ?? null, [body]);
  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return (people?.data ?? []).filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);
  // On shift first.
  const ordered = [...matches.filter((p) => p.on_shift), ...matches.filter((p) => !p.on_shift)];

  const pick = (p: Colleague) => {
    setBody((b) => b.replace(/@[\w-]*$/, `@${p.name} `));
    setMentions((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]));
    document.getElementById(areaId)?.focus();
  };

  const submit = async (force = false) => {
    if (!body.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const used = mentions.filter((p) => body.includes(`@${p.name}`));
      // `force` posts the note even though the case changed (after a 409 case_changed).
      await apiFetch("POST", `/cases/${caseId}/notes`, { body, visibility, mentions: used.map((p) => p.id), force: force || undefined });
      setConflict(null);
      await mutate(`/cases/${caseId}/timeline`);
      setBody("");
      setMentions([]);
      toast({
        tone: "success",
        title: "Note added",
        body: used.length ? `${used.map((p) => firstName(p.name)).join(", ")} will be notified.` : "It’s on the timeline.",
      });
    } catch (err) {
      if (isProblem(err, "case_changed")) setConflict(err);
      else setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="Add a note" className="w-[400px] shrink-0">
        <div className="relative">
          <TextArea
            id={areaId}
            label="Note"
            rows={4}
            placeholder="What did you find? Type @ to mention a colleague."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (!ordered.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % ordered.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i - 1 + ordered.length) % ordered.length);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pick(ordered[active]);
              }
            }}
          />
          {ordered.length > 0 && (
            <div role="listbox" aria-label="Mention a colleague" className="absolute top-[calc(100%-4px)] left-0 z-20 flex w-80 flex-col gap-0.5 rounded-lg border border-border-default bg-surface-base p-1 shadow-lg">
              {ordered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={ordered[active]?.id === p.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                  className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-sunken", ordered[active]?.id === p.id && "bg-surface-sunken")}
                >
                  <Avatar initials={p.initials} size={32} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-label-s text-text-primary">{p.name}</span>
                    <span className="text-caption text-text-secondary">{sentence(roleLabel(p.role))}</span>
                  </span>
                  <Badge label={p.status === "on_leave" ? "On leave" : p.on_shift ? "On shift" : "Off shift"} tone={p.on_shift && p.status !== "on_leave" ? "success" : "neutral"} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          <Select label="Visible to" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="flex-1">
            <option value="internal">Case team (internal)</option>
            <option value="supervisor">Shared with supervisor</option>
          </Select>
          <Button size="md" onClick={() => submit()} loading={busy} disabled={!body.trim()}>
            Add note
          </Button>
        </div>
        <RequestError error={failure} />
        <p className="text-caption text-text-tertiary">You can edit a note for 15 min. After that, add a correction.</p>
      </Card>
      {conflict && (
        <ConflictModal
          problem={conflict}
          note={body}
          onDiscard={() => {
            setBody("");
            setConflict(null);
          }}
          onClose={() => setConflict(null)}
          onPost={() => submit(true)}
          busy={busy}
        />
      )}
    </>
  );
}
