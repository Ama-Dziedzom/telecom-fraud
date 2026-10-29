"use client";

import { EmptyState } from "@/components/app/EmptyState";
import { caseStatusLabel, riskTone } from "@/components/app/indicators";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { fraudTypeLabel, useApi, type SearchHit, type SearchResult } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chips } from "./Chips";

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

type Filter = "all" | Hit["kind"];
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "case", label: "Cases" },
  { id: "subscriber", label: "Subscribers" },
  { id: "alert", label: "Alerts" },
  { id: "action", label: "Actions" },
];

/** Command item icons — 16, neutral. */
const ICON: Record<string, string> = {
  case: "app/icon-folder-secondary-16",
  subscriber: "app/icon-user-secondary-16",
  alert: "app/icon-alert-triangle-secondary-18",
  action: "app/icon-search-18",
  handover: "app/icon-users-secondary-16",
};

/** I1/I2 · ⌘K — cases, subscribers, alerts and actions in one list. */
export function CommandPalette({ onClose, onHandover }: { onClose: () => void; onHandover: () => void }) {
  const router = useRouter();
  const operatorName = useOperatorName() ?? "MTN Ghana";
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState(0);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150);
    return () => clearTimeout(t);
  }, [q]);

  const { data: result } = useApi<SearchResult>(debounced.length >= 2 ? `/search?q=${encodeURIComponent(debounced)}&type=all` : null);
  const data = useMemo(() => {
    if (!result) return undefined;
    const none = result.data.length === 0;
    const noCase = none && result.max_case_id;
    const empty = !none
      ? undefined
      : noCase
        ? { title: `No case ${debounced.toUpperCase()}`, detail: `Case numbers on ${operatorName} currently go up to ${result.max_case_id}.` }
        : result.other_operator
          ? { title: `This number is on ${result.other_operator.name}`, detail: `Search only finds ${operatorName} subscribers. Subscriber lookup also searches other operators.` }
          : { title: `No matches for “${debounced}”`, detail: "Check the number, or look it up in Subscriber lookup, which also searches other operators." };
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
  const suggestions = data?.empty ? [...data.did_you_mean, ...data.try_instead] : [];
  const groups: Array<[string, Hit[]]> = data?.empty
    ? [
        ["Did you mean", data.did_you_mean],
        ["Try instead", data.try_instead],
      ]
    : [
        ["Best match", hits.filter((h) => h.best)],
        ["Subscribers", hits.filter((h) => !h.best && h.kind === "subscriber")],
        ["Cases", hits.filter((h) => !h.best && h.kind === "case")],
        ["Alerts", hits.filter((h) => !h.best && h.kind === "alert")],
        ["Actions", filter === "all" || filter === "action" ? actions : []],
      ];
  const flat = groups.flatMap(([, g]) => g);
  // I2 · nothing to suggest: the empty state with a way out.
  const noResults = Boolean(data?.empty) && suggestions.length === 0;

  const lookup = () => {
    onClose();
    router.push(`/lookup?q=${encodeURIComponent(debounced)}`);
  };
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
    <div className="fixed inset-0 z-50 flex justify-center bg-overlay pt-24" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label="Search" className="flex h-fit max-h-[640px] w-[640px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-border-default bg-surface-base shadow-lg">
        <div className="flex flex-col gap-3 border-b border-border-default p-4">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-focus">
            <Icon name="app/icon-search" size={16} />
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
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (noResults && debounced) lookup();
                  else if (flat[active]) open(flat[active]);
                } else if (e.key === "Tab") {
                  e.preventDefault();
                  const i = FILTERS.findIndex((f) => f.id === filter);
                  setFilter(FILTERS[(i + (e.shiftKey ? FILTERS.length - 1 : 1)) % FILTERS.length].id);
                  setActive(0);
                } else if (e.key === "Escape") onClose();
              }}
              placeholder="Search MSISDN, case ID, IMEI or name…"
              className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
            />
          </label>
          <Chips
            label="Filter by type"
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setActive(0);
              input.current?.focus();
            }}
            options={FILTERS}
          />
        </div>

        {noResults && data?.empty ? (
          <EmptyState
            bare
            icon="app/icon-search-18"
            title={data.empty.title}
            className="py-14"
            actions={
              <Button variant="secondary" size="md" onClick={lookup}>
                Open Subscriber lookup
              </Button>
            }
          >
            {data.empty.detail}
          </EmptyState>
        ) : (
          <div id="palette-list" role="listbox" aria-label="Results" className="flex min-h-0 flex-col overflow-y-auto p-2">
            {data?.empty && (
              <div className="px-2 pt-2 pb-1">
                <p className="text-title text-text-primary">{data.empty.title}</p>
                <p className="text-caption text-text-secondary">{data.empty.detail}</p>
              </div>
            )}
            {!debounced && <p className="px-2 pt-2 pb-1 text-body-s text-text-secondary">Type a number, case ID, IMEI or name.</p>}
            {groups.map(([label, items]) =>
              items.length ? (
                <div key={label} className="flex flex-col">
                  <p className="px-2 pt-2.5 pb-1 text-caption text-text-secondary">{label}</p>
                  {items.map((h) => {
                    const i = flat.indexOf(h);
                    const selected = i === active;
                    return (
                      /* Command item (1343:269552) */
                      <div
                        key={h.kind + h.id}
                        id={`pal-${i}`}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => open(h)}
                        className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2", selected && "bg-surface-sunken")}
                      >
                        <span className="icon-tint flex shrink-0 text-text-secondary">
                          <Icon name={ICON[h.id === "handover" ? "handover" : h.kind]} size={16} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-body-m text-text-primary">{h.title}</span>
                            {h.badge && <Badge label={h.badge} tone="critical" />}
                          </span>
                          {h.subtitle && <span className="truncate text-caption text-text-secondary">{h.subtitle}</span>}
                        </span>
                        {h.id === "handover" ? (
                          <span className="text-caption text-text-tertiary">Ctrl Shift H</span>
                        ) : (
                          selected && <span className="text-caption text-text-tertiary">Enter</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null,
            )}
          </div>
        )}

        <p className="border-t border-border-default px-4 py-3 text-caption text-text-tertiary">
          Arrow keys to move · Enter to open · Tab to filter by type · Esc to close
        </p>
      </div>
    </div>
  );
}
