"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Card } from "@/components/app/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isProblem, type ApiError } from "@/lib/api/client";
import { ConflictModal } from "./CaseProblem";
import { useColleagues, useTimeline, type Colleague, type TimelineEvent } from "@/lib/api/cases";
import { roleLabel } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatWhen } from "@/lib/time";
import { useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";

type Filter = "all" | "people" | "system" | "notes";

const SOURCE_BADGE: Record<string, { label: string; tone: "brand" | "critical" | "neutral" }> = {
  system: { label: "System", tone: "neutral" },
  momo: { label: "MoMo", tone: "neutral" },
  network: { label: "Network", tone: "neutral" },
  crm: { label: "CRM", tone: "neutral" },
};
const DOT: Record<string, string> = { opened: "bg-critical-fg", device: "bg-medium-fg" };

function eventBadge(e: TimelineEvent) {
  if (e.source === "person" && e.actor) return { label: e.actor.name, tone: "brand" as const };
  if (e.kind === "opened") return { label: "System", tone: "critical" as const };
  return SOURCE_BADGE[e.source] ?? { label: e.source, tone: "neutral" as const };
}

/** C4/C7 · Timeline + add a note (with @mentions). */
export function TimelineTab({ caseId, now }: { caseId: string; now: number }) {
  const { data } = useTimeline(caseId);
  const [filter, setFilter] = useState<Filter>("all");
  const events = data?.data ?? [];
  const count = {
    all: events.length,
    people: events.filter((e) => e.source === "person").length,
    system: events.filter((e) => e.source !== "person").length,
    notes: events.filter((e) => e.kind === "note").length,
  };
  const shown = events.filter(
    (e) =>
      filter === "all" ||
      (filter === "people" && e.source === "person") ||
      (filter === "system" && e.source !== "person") ||
      (filter === "notes" && e.kind === "note"),
  );

  return (
    <div className="flex items-start gap-4">
      <Card title="Activity" aside={<span className="text-caption text-text-tertiary">Newest first</span>} className="flex-1">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All", count: count.all },
            { id: "people", label: "People", count: count.people },
            { id: "system", label: "System", count: count.system },
            { id: "notes", label: "Notes", count: count.notes },
          ]}
        />
        <ol className="relative flex flex-col gap-5 pl-6">
          <span aria-hidden className="absolute top-2 bottom-2 left-[4px] w-0.5 bg-border-default" />
          {shown.map((e) => {
            const badge = eventBadge(e);
            return (
              <li key={e.id} className="relative flex flex-col gap-1">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 -left-6 size-2.5 rounded-full",
                    DOT[e.kind] ?? (e.source === "person" ? "bg-brand-primary" : "bg-border-strong"),
                  )}
                />
                <p className="flex items-center gap-2">
                  <span className="font-mono text-mono-s text-text-tertiary">{formatWhen(e.at, now)}</span>
                  <Badge label={badge.label} tone={badge.tone} />
                </p>
                <p className="text-label-m text-text-primary">{e.title}</p>
                {e.detail && <p className="text-body-s text-text-secondary">{e.detail}</p>}
              </li>
            );
          })}
        </ol>
      </Card>
      <NoteComposer caseId={caseId} />
    </div>
  );
}

/** Add a note — internal or shared with the supervisor; “@” suggests colleagues. */
function NoteComposer({ caseId }: { caseId: string }) {
  const { data: people } = useColleagues();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const area = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "supervisor">("internal");
  const [mentions, setMentions] = useState<Colleague[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [active, setActive] = useState(0);

  // The word being typed after an “@”, if any.
  const query = useMemo(() => body.match(/@([\w-]*)$/)?.[1] ?? null, [body]);
  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return (people?.data ?? []).filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);

  const pick = (p: Colleague) => {
    setBody((b) => b.replace(/@[\w-]*$/, `@${p.name} `));
    setMentions((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]));
    area.current?.focus();
  };

  const [conflict, setConflict] = useState<ApiError | null>(null);

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
        body: used.length ? `${used.map((p) => p.name.split(" ")[0]).join(", ")} will be notified.` : "It’s on the timeline.",
      });
    } catch (err) {
      if (isProblem(err, "case_changed")) setConflict(err);
      else setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  const onShift = matches.filter((p) => p.on_shift);
  const others = matches.filter((p) => !p.on_shift);
  const ordered = [...onShift, ...others];
  const mentioned = mentions.filter((p) => body.includes(`@${p.name}`));

  return (
    <>
    <Card title="Add a note" icon="app/icon-message-18" className="w-[480px] shrink-0">
      <div className="relative flex flex-col gap-3 rounded-[10px] border-[1.5px] border-border-focus px-3 py-2.5 shadow-focus">
        <textarea
          ref={area}
          rows={3}
          aria-label="Note"
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
          className="resize-none bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
        />
        <div className="flex items-center gap-2">
          <label className="relative flex h-8 items-center gap-1.5 rounded-lg border border-border-default px-2.5 text-label-s text-text-primary">
            <Icon name="app/icon-message-18" size={16} />
            <select
              aria-label="Who can see it"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="cursor-pointer appearance-none bg-transparent pr-5 outline-none focus-visible:shadow-none"
            >
              <option value="internal">Internal note</option>
              <option value="supervisor">Shared with supervisor</option>
            </select>
            <Icon name="app/icon-chevron-down-16" size={16} className="pointer-events-none absolute right-2" />
          </label>
          <span className="flex-1" />
          <Button size="sm" onClick={() => submit()} loading={busy} disabled={!body.trim()}>
            Add note
          </Button>
        </div>
        {ordered.length > 0 && (
          <div role="listbox" aria-label="Mention a colleague" className="absolute top-full left-0 z-20 mt-1 flex w-[300px] flex-col gap-0.5 rounded-xl border border-border-default bg-surface-base p-1.5 shadow-lg">
            {[
              ["On shift", onShift],
              ["Others", others],
            ].map(([label, list]) =>
              (list as Colleague[]).length ? (
                <div key={label as string} className="flex flex-col gap-0.5">
                  <p className="px-2.5 pt-2 pb-1 text-overline text-text-tertiary uppercase">{label as string}</p>
                  {(list as Colleague[]).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={ordered[active]?.id === p.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(p);
                      }}
                      className={cn("flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left", ordered[active]?.id === p.id && "bg-surface-sunken")}
                    >
                      <Icon name="app/icon-user-secondary-16" size={16} className="mt-0.5" />
                      <span className="flex flex-col">
                        <span className="text-label-m text-text-primary">{p.name}</span>
                        <span className="text-caption text-text-secondary">{[roleLabel(p.role), p.status === "on_leave" ? "on leave" : p.shift].join(" · ")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
      {mentioned.map((p) => (
        <div key={p.id} className="flex items-center gap-2.5 rounded-[10px] border border-border-subtle px-3 py-2">
          <Avatar initials={p.initials} />
          <span className="flex flex-col">
            <span className="text-label-m text-text-primary">{p.name}</span>
            <span className="text-caption text-text-secondary">
              {roleLabel(p.role)} · {p.status === "on_leave" ? "on leave" : p.on_shift ? "on shift" : "off shift"}
            </span>
          </span>
        </div>
      ))}
      <RequestError error={failure} />
      <p className="text-caption text-text-secondary">
        Notes become part of the case record. You can edit for 15 minutes; after that, add a correction instead.
      </p>
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
