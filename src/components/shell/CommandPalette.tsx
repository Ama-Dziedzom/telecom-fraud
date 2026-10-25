"use client";

import { caseStatusLabel, riskTone } from "@/components/app/indicators";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { fraudTypeLabel, useApi, type SearchHit, type SearchResult } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/** One row: a search hit written for the palette, or one of the palette’s own actions. */
type Hit = { id: string; kind: "case" | "subscriber" | "alert" | "action"; title: string; subtitle: string; badge?: string; best?: boolean };

const ALERT_STATUS: Record<string, string> = { auto_case: "opened", promoted: "promoted to", attached: "added to" };

function toHit(h: SearchHit): Hit {
  if (h.case) {
    const c = h.case;
    return {
      id: h.id,
      kind: "case",
      title: c.id,
      subtitle: [fraudTypeLabel(c.fraud_type), c.subscriber.msisdn, caseStatusLabel(c.status)].join(" · "),
      badge: riskTone(c.risk_score) === "critical" ? "Critical" : undefined,
      best: h.best,
    };
  }
  if (h.subscriber) {
    const s = h.subscriber;
    const cases = h.open_cases ? `${h.open_cases} open ${h.open_cases === 1 ? "case" : "cases"}` : "no cases";
    return {
      id: h.id,
      kind: "subscriber",
      title: s.msisdn,
      subtitle: [s.name, s.area.split(",")[0], s.status === "active" ? cases : s.status.replace(/_/g, " ")].join(" · "),
      best: h.best,
    };
  }
  const a = h.alert;
  return {
    id: h.id,
    kind: "alert",
    title: h.id,
    subtitle: a ? [a.title, a.case_id && `${ALERT_STATUS[a.status] ?? "in"} ${a.case_id}`].filter(Boolean).join(" · ") : "",
    best: h.best,
  };
}

const FILTERS = [
  ["all", "All"],
  ["case", "Cases"],
  ["subscriber", "Subscribers"],
  ["alert", "Alerts"],
  ["action", "Actions"],
] as const;
const ICON: Record<Hit["kind"], string> = {
  case: "app/icon-folder-secondary-16",
  subscriber: "app/icon-user-secondary-16",
  alert: "app/icon-alert-triangle-secondary-18",
  action: "app/icon-search-18",
};

/** I1/I2 · ⌘K — cases, subscribers, alerts and actions in one list. */
export function CommandPalette({ onClose, onHandover }: { onClose: () => void; onHandover: () => void }) {
  const router = useRouter();
  const operatorName = useOperatorName() ?? "Kasa Mobile";
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [active, setActive] = useState(0);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150);
    return () => clearTimeout(t);
  }, [q]);

  const { data: result } = useApi<SearchResult>(debounced.length >= 2 ? `/search?q=${encodeURIComponent(debounced)}&type=all` : null);
  const data = useMemo(() => {
    if (!result) return undefined;
    const noCase = result.data.length === 0 && result.max_case_id;
    const empty = noCase
      ? { title: `No case ${debounced.toUpperCase()}`, detail: `Case numbers on ${operatorName} currently go up to ${result.max_case_id}.` }
      : result.data.length === 0 && result.other_operator
        ? { title: `This number is on ${result.other_operator.name}`, detail: `Search only finds ${operatorName} subscribers.` }
        : undefined;
    const tryInstead: Hit[] = noCase
      ? [{ kind: "action", id: "search_all_cases", title: `Search all cases for “${debounced.replace(/\D/g, "")}”`, subtitle: "Includes closed and other teams’ cases you can see" }]
      : [];
    return { data: result.data.map(toHit), empty, did_you_mean: (result.did_you_mean ?? []).map(toHit), try_instead: tryInstead };
  }, [result, debounced, operatorName]);

  const actions: Hit[] = useMemo(
    () => [
      ...(debounced ? [{ id: "lookup", kind: "action" as const, title: `Look up “${debounced}” in Subscriber lookup`, subtitle: "Search by partial number" }] : []),
      { id: "handover", kind: "action" as const, title: "Hand over shift", subtitle: "" },
    ],
    [debounced],
  );
  const hits = (data?.data ?? []).filter((h) => filter === "all" || h.kind === filter);
  const groups: Array<[string, Hit[]]> = data?.empty
    ? [
        ["Did you mean", data.did_you_mean ?? []],
        ["Try instead", data.try_instead ?? []],
      ]
    : [
        ["Best match", hits.filter((h) => h.best)],
        ["Subscribers", hits.filter((h) => !h.best && h.kind === "subscriber")],
        ["Cases", hits.filter((h) => !h.best && h.kind === "case")],
        ["Alerts", hits.filter((h) => !h.best && h.kind === "alert")],
        ["Actions", filter === "all" || filter === "action" ? actions : []],
      ];
  const flat = groups.flatMap(([, g]) => g);

  const open = (h: Hit) => {
    onClose();
    if (h.kind === "case") router.push(`/cases/${h.id}`);
    else if (h.kind === "subscriber") router.push(`/subscribers/${h.id}`);
    else if (h.kind === "alert") router.push(`/alerts?alert=${h.id}`);
    else if (h.id === "handover") onHandover();
    else if (h.id === "search_all_cases") router.push(`/cases?scope=all&q=${encodeURIComponent(debounced.replace(/\D/g, ""))}`);
    else router.push(`/lookup?q=${encodeURIComponent(debounced)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[rgb(20_18_51/0.35)] pt-[110px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label="Search" className="flex h-fit max-h-[640px] w-[680px] flex-col overflow-hidden rounded-2xl bg-surface-base shadow-lg">
        <label className="flex h-14 items-center gap-3 border-b border-border-subtle px-5">
          <Icon name="app/icon-search-primary-18" size={18} />
          <input
            ref={input}
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={flat[active] ? `pal-${active}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(flat.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && flat[active]) {
                e.preventDefault();
                open(flat[active]);
              } else if (e.key === "Tab") {
                e.preventDefault();
                const i = FILTERS.findIndex(([id]) => id === filter);
                setFilter(FILTERS[(i + 1) % FILTERS.length][0]);
              } else if (e.key === "Escape") onClose();
            }}
            placeholder="Search MSISDN, case ID, IMEI or name…"
            className="min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
          />
          <kbd className="rounded-[5px] border border-border-default bg-surface-sunken px-1.5 py-0.5 font-mono text-mono-s text-text-secondary">⌘K</kbd>
        </label>
        {!data?.empty && (
          <div className="flex gap-1.5 px-5 pt-3" role="group" aria-label="Filter by type">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cn("rounded-full px-2.5 py-0.5 text-caption font-medium", filter === id ? "bg-brand-primary-subtle text-text-brand" : "bg-surface-sunken text-text-secondary")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div id="palette-list" role="listbox" aria-label="Results" className="flex min-h-0 flex-col overflow-y-auto px-2 py-2">
          {data?.empty && (
            <div className="px-3 pt-2 pb-1">
              <p className="text-title text-text-primary">{data.empty.title}</p>
              <p className="text-caption text-text-secondary">{data.empty.detail}</p>
            </div>
          )}
          {!debounced && <p className="px-3 py-6 text-center text-body-s text-text-secondary">Type a number, case ID, IMEI or name.</p>}
          {groups.map(([label, items]) =>
            items.length ? (
              <div key={label} className="flex flex-col">
                <p className="px-3 pt-2.5 pb-1 text-overline text-text-tertiary uppercase">{label}</p>
                {items.map((h) => {
                  const i = flat.indexOf(h);
                  return (
                    <div
                      key={h.kind + h.id}
                      id={`pal-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => open(h)}
                      className={cn("flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2", i === active && "bg-brand-primary-subtle/70")}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken">
                        <Icon name={ICON[h.kind]} size={16} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <span className={cn(h.kind === "action" ? "text-label-m" : "font-mono text-mono-m", h.kind === "case" ? "text-text-brand" : "text-text-primary")}>{h.title}</span>
                          {h.badge && <Badge label={h.badge} tone="critical" dot />}
                        </span>
                        {h.subtitle && <span className="truncate text-caption text-text-secondary">{h.subtitle}</span>}
                      </span>
                      {h.id === "handover" && <span className="font-mono text-mono-s text-text-tertiary">Ctrl Shift H</span>}
                      {i === active && h.id !== "handover" && <span className="text-caption text-text-tertiary">↵</span>}
                    </div>
                  );
                })}
              </div>
            ) : null,
          )}
        </div>
        <p className="flex gap-4 border-t border-border-subtle bg-surface-raised px-5 py-2 text-caption text-text-tertiary">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>⇥ filter by type</span>
          <span className="flex-1" />
          <span>esc close</span>
        </p>
      </div>
    </div>
  );
}
