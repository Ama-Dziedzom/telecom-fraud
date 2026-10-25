"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card, Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { RiskScore } from "@/components/app/indicators";
import { BulkLookupModal, hitNote, hitSubtitle, identifierProblem, RequestInfoModal } from "@/components/lookup/LookupModals";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/api/client";
import { useApi, type SearchHit, type SearchResult } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClockOrDay, useNow } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";

type Hit = SearchHit & { subscriber: NonNullable<SearchHit["subscriber"]> };
type Recent = { identifier: string; name: string; type: "msisdn" | "imei" | "wallet"; entity_id: string; case_id: string | null; risk_score: number; at: string };
type Watch = {
  id: string;
  entity_id: string;
  entity_type: string;
  identifier: string;
  case_id: string | null;
  reason: string;
  until: string;
  status: "watching" | "hit";
  hits: number;
  last_hit_at?: string;
};

const TYPES = [
  ["auto", "Auto-detect"],
  ["msisdn", "Phone number"],
  ["imei", "IMEI"],
  ["wallet", "Wallet ID"],
  ["ghana_card", "Ghana Card"],
] as const;
const DETECTED: Record<string, string> = { msisdn: "Phone number detected", imei: "IMEI detected", ghana_card: "Ghana Card detected", wallet: "Wallet ID detected" };
const TRY = ["+233 54 *** 3457", "IMEI 356938…4417", "GHA-7231…-4"];
const RECENT_TYPE: Record<Recent["type"], string> = { msisdn: "Phone", imei: "Device", wallet: "Wallet" };
const WATCH_REASON: Record<string, string> = {
  victim_repeat: "Repeat victim",
  suspect_agent: "Suspected agent",
  linked_to_case: "Linked to a case",
  gateway: "Possible gateway",
};
const WATCH_ENTITY: Record<string, string> = { subscriber: "Number", wallet: "Wallet", agent: "Agent", device: "Device" };
/** “Mule wallet · FD-2998” / “Suspected agent · 3 hits · FD-3050” */
const watchDetail = (w: Watch) =>
  [
    w.reason === "mule" ? `Mule ${(WATCH_ENTITY[w.entity_type] ?? w.entity_type).toLowerCase()}` : (WATCH_REASON[w.reason] ?? WATCH_ENTITY[w.entity_type] ?? w.entity_type),
    w.hits ? `${w.hits} ${w.hits === 1 ? "hit" : "hits"}` : "",
    w.case_id ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

/** “+233 54 *** 3457 Kojo M.” with the number in mono and the name after it. */
function HitTitle({ hit }: { hit: Hit }) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-mono-m text-text-primary">{hit.subscriber.msisdn}</span>
      <span className="text-label-m text-text-primary">{hit.subscriber.name}</span>
    </span>
  );
}

/** Auto-detect is the API’s default, so it isn’t sent. */
const searchPath = (q: string, type: string) => `/search?q=${encodeURIComponent(q)}${type === "auto" ? "" : `&type=${type}`}`;
const subscriberHits = (r: SearchResult | undefined) => (r?.data ?? []).filter((h): h is Hit => h.kind === "subscriber" && Boolean(h.subscriber));

/** G14–G17 · Subscriber lookup — search by phone, wallet, IMEI or Ghana Card; every lookup is logged. */
export default function LookupPage() {
  const router = useRouter();
  const now = useNow();
  const { mutate } = useSWRConfig();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState<string>("auto");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "bulk" | "request">(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const searching = debounced.replace(/\D/g, "").length >= 4 || /^gha|^imei/i.test(debounced);
  const { data: matches } = useApi<SearchResult>(searching ? searchPath(debounced, type) : null);
  const { data: result, isLoading: resultLoading } = useApi<SearchResult>(submitted ? searchPath(submitted, type) : null);
  const { data: recent } = useApi<{ data: Recent[] }>("/lookups/recent");
  const { data: watch } = useApi<{ data: Watch[] }>("/me/watchlist");
  const hits = subscriberHits(matches);
  const found = subscriberHits(result);
  const showSuggest = open && searching && hits.length > 0 && !invalid;
  const noMatch = submitted && result && found.length === 0;

  const openHit = (h: Hit, newTab = false) => {
    const href = `/subscribers/${h.id}`;
    if (newTab) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  const lookUp = () => {
    const problem = type === "auto" || type === "msisdn" ? identifierProblem(q) : null;
    if (problem === "is too short" || problem === "is too long") {
      setInvalid(`That’s ${problem.replace("is ", "")} for a phone number. Use 10 digits (054 123 4567) or +233 followed by 9 digits.`);
      return;
    }
    setInvalid(null);
    if (hits.length === 1 && debounced === q.trim()) return openHit(hits[0]);
    setOpen(false);
    setSubmitted(q.trim());
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && showSuggest) {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === "ArrowUp" && showSuggest) {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggest) openHit(hits[active], e.metaKey || e.ctrlKey);
      else lookUp();
    } else if (e.key === "Escape") setOpen(false);
  };

  return (
    <>
      <AppHeader section="Investigate" title="Subscriber lookup" />
      <PageBody>
        <PageHead
          title="Subscriber lookup"
          subtitle="Search any subscriber by phone number, wallet ID, IMEI or Ghana Card number. Every lookup is logged."
          actions={
            <Button variant="secondary" size="md" onClick={() => setDialog("bulk")} iconLeft={<Icon name="app/icon-file-secondary-18" size={18} />}>
              Bulk lookup
            </Button>
          }
        />

        <section className={cn("flex flex-col gap-3 rounded-xl border bg-surface-base px-4 py-4", invalid ? "border-critical-border" : "border-border-subtle")}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <label
                className={cn(
                  "flex h-12 items-center gap-2.5 rounded-lg border bg-surface-base px-3.5",
                  invalid ? "border-critical-fg" : "border-border-default focus-within:border-border-focus focus-within:shadow-focus",
                )}
              >
                <Icon name="app/icon-search-18" size={18} />
                <input
                  role="combobox"
                  aria-expanded={showSuggest}
                  aria-controls="lookup-suggestions"
                  aria-activedescendant={showSuggest ? `hit-${active}` : undefined}
                  aria-invalid={Boolean(invalid)}
                  aria-describedby={invalid ? "lookup-error" : undefined}
                  aria-label="Phone number, IMEI, wallet or Ghana Card"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setOpen(true);
                    setActive(0);
                    setInvalid(null);
                    setSubmitted(null);
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  onKeyDown={onKey}
                  placeholder="e.g. 024 123 4567, IMEI, wallet or Ghana Card"
                  className="min-w-0 flex-1 bg-transparent font-mono text-mono-m text-text-primary outline-none placeholder:font-sans placeholder:text-body-m placeholder:text-text-tertiary focus-visible:shadow-none"
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => {
                      setQ("");
                      setSubmitted(null);
                      setInvalid(null);
                    }}
                    className="flex rounded"
                  >
                    <Icon name="app/icon-x-primary-18" size={16} />
                  </button>
                )}
              </label>
              {showSuggest && (
                <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 overflow-hidden rounded-xl border border-border-default bg-surface-base shadow-lg">
                  <p className="flex justify-between border-b border-border-subtle bg-surface-raised px-3.5 py-2 text-overline text-text-tertiary uppercase">
                    <span>
                      {hits.length} {hits.length === 1 ? "subscriber matches" : "subscribers match"} “{debounced}”
                    </span>
                    <span className="normal-case tracking-normal">{DETECTED[matches?.detected_type ?? ""] ?? ""}</span>
                  </p>
                  <ul id="lookup-suggestions" role="listbox" aria-label="Matches">
                    {hits.map((h, i) => (
                      <li
                        key={h.id}
                        id={`hit-${i}`}
                        role="option"
                        aria-selected={i === active}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => openHit(h, e.metaKey || e.ctrlKey)}
                        onMouseEnter={() => setActive(i)}
                        className={cn("flex cursor-pointer items-center gap-3 border-b border-border-subtle px-3.5 py-2.5", i === active && "bg-brand-primary-subtle/60")}
                      >
                        <span className="flex size-8 items-center justify-center rounded-full bg-brand-primary-subtle">
                          <Icon name="app/icon-user-brand-20" size={16} />
                        </span>
                        <span className="flex flex-1 flex-col">
                          <span className="flex items-center gap-2">
                            <HitTitle hit={h} />
                            {hitNote(h.subscriber) && <span className="text-body-s text-text-secondary">{hitNote(h.subscriber)}</span>}
                          </span>
                          <span className="text-caption text-text-secondary">{hitSubtitle(h.subscriber)}</span>
                        </span>
                        {h.open_cases ? (
                          <Badge label={`${h.open_cases} open ${h.open_cases === 1 ? "case" : "cases"}`} tone="critical" dot />
                        ) : (
                          <span className="text-caption text-text-tertiary">No cases</span>
                        )}
                        {i === active && <span className="text-caption text-text-tertiary">↵</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="bg-surface-raised px-3.5 py-2 text-caption text-text-tertiary">↑↓ move · ↵ open profile · ⌘↵ open in new tab</p>
                </div>
              )}
            </div>
            <label className="relative flex h-12 w-[190px] items-center gap-2 rounded-lg border border-border-default bg-surface-base pr-8 pl-3">
              <Icon name="app/icon-sliders-18" size={16} />
              <select
                aria-label="Identifier type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="min-w-0 flex-1 appearance-none bg-transparent text-body-m text-text-primary outline-none focus-visible:shadow-none"
              >
                {TYPES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <Icon name="app/icon-chevron-down-16" size={14} className="pointer-events-none absolute right-3" />
            </label>
            <Button size="lg" onClick={lookUp} disabled={!q.trim()}>
              Look up
            </Button>
          </div>
          {invalid ? (
            <p id="lookup-error" className="flex items-center gap-1.5 text-caption text-critical-fg">
              <Icon name="icon-alert-critical" size={14} />
              {invalid}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              Try
              {TRY.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setQ(t);
                    setOpen(true);
                  }}
                  className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-mono-s text-text-secondary hover:text-text-primary"
                >
                  {t}
                </button>
              ))}
              <span className="flex-1" />
              <Icon name="app/icon-shield-tertiary-16" size={14} />
              Numbers are masked until you reveal them with a reason
            </div>
          )}
        </section>

        {noMatch ? (
          <EmptyState
            icon="app/icon-search-18"
            tone="neutral"
            title={`No Kasa Mobile subscriber with ${submitted}`}
            className="min-h-[300px]"
            actions={
              <>
                <Button variant="secondary" size="md" onClick={() => setDialog("request")} iconLeft={<Icon name="app/icon-send-18" size={18} />}>
                  Request info from operator
                </Button>
                <Button
                  size="md"
                  onClick={() => {
                    setSubmitted(null);
                    setQ("");
                  }}
                  iconLeft={<Icon name="app/icon-search-white-18" size={18} />}
                >
                  Search again
                </Button>
              </>
            }
          >
            {result.other_operator
              ? `${submitted.replace(/\D/g, "").replace(/^233/, "0").slice(0, 3)} numbers usually belong to another network. `
              : ""}
            It may also never have been activated, or was purged after 24 months of inactivity.
          </EmptyState>
        ) : submitted && resultLoading ? (
          <Skeleton className="h-[300px] w-full rounded-xl" />
        ) : submitted && result && found.length > 1 ? (
          <Card title={`${found.length} matches for “${submitted}”`} icon="app/icon-search-18">
            <ul className="flex flex-col">
              {found.map((h) => (
                <li key={h.id} className="border-b border-border-subtle last:border-b-0">
                  <Link href={`/subscribers/${h.id}`} className="flex items-center gap-3 py-3">
                    <span className="flex flex-1 flex-col">
                      <HitTitle hit={h} />
                      <span className="text-caption text-text-secondary">{hitSubtitle(h.subscriber)}</span>
                    </span>
                    <Icon name="app/icon-chevron-right-16" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <div className="flex items-start gap-4">
            <Card
              title="Recent lookups"
              icon="app/icon-history-18"
              className="min-w-0 flex-1"
              aside={
                recent?.data.length ? (
                  <button
                    type="button"
                    onClick={async () => {
                      // Clears your list, not the audit log.
                      await apiFetch("DELETE", "/lookups/recent").catch(() => undefined);
                      await mutate("/lookups/recent");
                    }}
                    className="rounded text-label-s text-text-brand hover:underline"
                  >
                    Clear
                  </button>
                ) : undefined
              }
            >
              {!recent ? (
                <Skeleton className="h-[200px] w-full rounded-lg" />
              ) : recent.data.length === 0 ? (
                <p className="py-6 text-center text-body-s text-text-secondary">Nothing yet. Your lookups show here; they’re still in the audit log.</p>
              ) : (
                <div className="overflow-hidden rounded-[10px] border border-border-subtle">
                  <table className="w-full text-left">
                    <thead className="bg-surface-raised">
                      <tr className="text-overline text-text-tertiary uppercase">
                        {["Identifier", "Name", "Type", "Case", "Risk", "When"].map((h, i) => (
                          <th key={h} className={cn("py-2.5 font-bold", i === 0 && "pl-3.5", i === 5 && "pr-3.5 text-right")}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.data.map((r) => (
                        <tr key={r.entity_id} onClick={() => router.push(`/subscribers/${r.entity_id}`)} className="cursor-pointer border-t border-border-subtle hover:bg-[#fbfaff]">
                          <td className="py-3 pl-3.5 font-mono text-mono-m text-text-primary">
                            {r.type === "imei" ? "IMEI " : ""}
                            {r.identifier}
                          </td>
                          <td className="py-3 text-body-s text-text-primary">{r.name}</td>
                          <td className="py-3">
                            <Badge label={RECENT_TYPE[r.type] ?? r.type} tone="neutral" />
                          </td>
                          <td className="py-3">
                            {r.case_id ? (
                              <Link href={`/cases/${r.case_id}`} onClick={(e) => e.stopPropagation()} className="rounded font-mono text-mono-s text-text-brand hover:underline">
                                {r.case_id}
                              </Link>
                            ) : (
                              <span className="text-caption text-text-tertiary">No case</span>
                            )}
                          </td>
                          <td className="py-3">
                            <RiskScore score={r.risk_score} />
                          </td>
                          <td className="py-3 pr-3.5 text-right text-caption text-text-secondary">{formatClockOrDay(r.at, now)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card
              title={
                <span className="flex items-center gap-2">
                  My watchlist
                  {watch && <span className="rounded-full bg-surface-sunken px-1.5 text-caption font-medium text-text-tertiary">{watch.data.length}</span>}
                </span>
              }
              icon="app/icon-eye-primary-18"
              className="w-[460px] shrink-0"
            >
              <ul className="flex flex-col">
                {watch?.data.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 border-b border-border-subtle py-3 last:border-b-0">
                    <span className="flex flex-1 flex-col">
                      <span className="font-mono text-mono-m text-text-primary">{w.identifier}</span>
                      <span className="text-caption text-text-secondary">{watchDetail(w)}</span>
                    </span>
                    <Badge label={w.status === "hit" ? "Active" : "Watching"} tone={w.status === "hit" ? "critical" : "high"} dot />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </PageBody>

      {dialog === "bulk" && <BulkLookupModal onClose={() => setDialog(null)} />}
      {dialog === "request" && submitted && <RequestInfoModal identifier={submitted} operator={result?.other_operator ?? null} onClose={() => setDialog(null)} />}
    </>
  );
}
