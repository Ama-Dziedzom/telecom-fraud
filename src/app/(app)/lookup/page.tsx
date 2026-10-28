"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { RiskScore } from "@/components/app/indicators";
import { localMsisdn } from "@/components/cases/CaseTable";
import { DataTable, Td, Th, rowClass } from "@/components/cases/Table";
import { BulkLookupModal, hitNote, hitSubtitle, identifierProblem, RequestInfoModal } from "@/components/lookup/LookupModals";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FieldLabel, Select } from "@/components/ui/TextField";
import { apiFetch } from "@/lib/api/client";
import { useApi, type SearchHit, type SearchResult } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatClockOrDay, useNow } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";

type Hit = SearchHit & { subscriber: NonNullable<SearchHit["subscriber"]> };
type Recent = {
  identifier: string;
  name: string;
  type: "msisdn" | "imei" | "wallet";
  entity_id: string;
  case_id: string | null;
  risk_score: number;
  at: string;
};
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
const DETECTED: Record<string, string> = {
  msisdn: "phone number detected",
  imei: "IMEI detected",
  ghana_card: "Ghana Card detected",
  wallet: "wallet ID detected",
};
const RECENT_TYPE: Record<Recent["type"], string> = {
  msisdn: "Phone",
  imei: "Device",
  wallet: "Wallet",
};
const WATCH_REASON: Record<string, string> = {
  victim_repeat: "Repeat victim",
  suspect_agent: "Suspected agent",
  linked_to_case: "Linked to a case",
  gateway: "Possible gateway",
};
const WATCH_ENTITY: Record<string, string> = {
  subscriber: "Number",
  wallet: "Wallet",
  agent: "Agent",
  device: "Device",
};
/** “Mule wallet · FD-2998” / “Suspected agent · 3 hits · FD-3050” */
const watchDetail = (w: Watch) =>
  [
    w.reason === "mule" ? `Mule ${(WATCH_ENTITY[w.entity_type] ?? w.entity_type).toLowerCase()}` : (WATCH_REASON[w.reason] ?? WATCH_ENTITY[w.entity_type] ?? w.entity_type),
    w.hits ? `${w.hits} ${w.hits === 1 ? "hit" : "hits"}` : "",
    w.case_id ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

/** Auto-detect is the API’s default, so it isn’t sent. */
const searchPath = (q: string, type: string) => `/search?q=${encodeURIComponent(q)}${type === "auto" ? "" : `&type=${type}`}`;
const subscriberHits = (r: SearchResult | undefined) => (r?.data ?? []).filter((h): h is Hit => h.kind === "subscriber" && Boolean(h.subscriber));

/** G14–G17 · Subscriber lookup (start, typing matches, no match, invalid identifier) — search by phone, wallet, IMEI or Ghana Card; every lookup is logged. */
export default function LookupPage() {
  const router = useRouter();
  const now = useNow();
  const operator = useOperatorName();
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
      setInvalid(`${problem === "is too short" ? "Too short" : "Too long"} for a phone number. Use 10 digits (054 123 4567) or +233 then 9 digits.`);
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

  const network = operator ?? "our network";
  const other = result?.other_operator?.name;

  return (
    <>
      <AppHeader section="Investigate" title="Subscriber lookup" />
      <PageBody>
        <PageHead
          title="Subscriber lookup"
          subtitle="Search by phone number, wallet ID, IMEI or Ghana Card number. Every lookup is logged."
          actions={
            <Button variant="secondary" size="md" onClick={() => setDialog("bulk")}>
              Bulk lookup
            </Button>
          }
        />

        <Card title="Find a subscriber">
          <div className="flex items-end gap-2.5">
            <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
              <FieldLabel htmlFor="lookup-q">Number, IMEI, wallet or Ghana Card</FieldLabel>
              <label
                className={cn(
                  "flex h-10 items-center gap-2 rounded-lg border bg-surface-base px-3",
                  invalid ? "border-critical-fg" : "border-border-default hover:border-border-strong focus-within:border-border-focus focus-within:shadow-focus",
                )}
              >
                <Icon name="app/icon-search-tertiary-16" size={16} />
                <input
                  id="lookup-q"
                  role="combobox"
                  aria-expanded={showSuggest}
                  aria-controls="lookup-suggestions"
                  aria-activedescendant={showSuggest ? `hit-${active}` : undefined}
                  aria-invalid={Boolean(invalid)}
                  aria-describedby={invalid ? "lookup-error" : "lookup-hint"}
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
                  className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
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
              {invalid && (
                <p id="lookup-error" className="absolute top-full mt-1.5 flex items-center gap-1.5 text-caption text-critical-fg">
                  <Icon name="app/icon-alert-circle-critical-14" size={14} />
                  {invalid}
                </p>
              )}
              {/* G15 · Typing matches. */}
              {showSuggest && (
                <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-30 rounded-lg border border-border-default bg-surface-base px-3 py-2 shadow-lg">
                  <p className="px-1 pb-1.5 text-caption text-text-secondary">
                    {hits.length} {hits.length === 1 ? "subscriber matches" : "subscribers match"} “{debounced}”
                    {DETECTED[matches?.detected_type ?? ""] ? ` · ${DETECTED[matches?.detected_type ?? ""]}` : ""}
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
                        className={cn("flex cursor-pointer items-center gap-3 border-b border-border-default px-1 py-2 last:border-b-0", i === active && "bg-surface-sunken")}
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-label-s text-text-primary">
                            {localMsisdn(h.subscriber.msisdn)} · {hitNote(h.subscriber) ? hitNote(h.subscriber).toLowerCase() : h.subscriber.name}
                          </span>
                          <span className="truncate text-caption text-text-secondary">{hitSubtitle(h.subscriber)}</span>
                        </span>
                        {h.open_cases ? (
                          <Badge label={`${h.open_cases} open ${h.open_cases === 1 ? "case" : "cases"}`} tone="critical" />
                        ) : (
                          <Badge label="No cases" tone="neutral" />
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="px-1 pt-2 text-caption text-text-secondary">Arrow keys to move · Enter to open the profile</p>
                </div>
              )}
            </div>
            <Select label="Type" aria-label="Identifier type" value={type} onChange={(e) => setType(e.target.value)} className="w-[162px] shrink-0">
              {TYPES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Button size="md" onClick={lookUp} disabled={!q.trim()}>
              Look up
            </Button>
          </div>
          <p id="lookup-hint" className={cn("text-caption text-text-secondary", invalid && "mt-5")}>
            Numbers stay masked until you reveal them with a reason.
          </p>

          {/* G16 · No match. */}
          {noMatch && (
            <EmptyState
              bare
              icon="app/icon-search-18"
              title={`No ${network} subscriber with ${localMsisdn(submitted)}`}
              actions={
                other ? (
                  <Button variant="secondary" size="md" onClick={() => setDialog("request")}>
                    Request info from {other}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setSubmitted(null);
                      setQ("");
                    }}
                  >
                    Search again
                  </Button>
                )
              }
            >
              {other
                ? `It looks like ${/^[aeiou]/i.test(other) ? "an" : "a"} ${other} number. You can ask ${other}’s fraud desk.`
                : "It may never have been activated, or was purged after 24 months of inactivity."}
            </EmptyState>
          )}
          {submitted && resultLoading && <Skeleton className="h-[120px] w-full rounded-lg" />}
          {submitted && result && found.length > 1 && (
            <ul className="flex flex-col border-t border-border-default">
              {found.map((h) => (
                <li key={h.id} className="border-b border-border-default last:border-b-0">
                  <Link href={`/subscribers/${h.id}`} className="flex items-center gap-3 py-3 hover:bg-surface-sunken">
                    <span className="flex flex-1 flex-col">
                      <span className="text-label-s text-text-primary">
                        {localMsisdn(h.subscriber.msisdn)} · {h.subscriber.name}
                      </span>
                      <span className="text-caption text-text-secondary">{hitSubtitle(h.subscriber)}</span>
                    </span>
                    <Icon name="app/icon-chevron-right-16" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex items-start gap-5">
          <Card
            title="Recent lookups"
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
                  className="flex h-8 items-center rounded text-label-s text-text-brand hover:underline"
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
              <DataTable>
                <colgroup>
                  <col className="w-[30%]" />
                  <col />
                  <col className="w-[82px]" />
                  <col className="w-[104px]" />
                  <col className="w-[124px]" />
                  <col className="w-[96px]" />
                </colgroup>
                <thead>
                  <tr>
                    <Th>Identifier</Th>
                    <Th>Name</Th>
                    <Th className="px-0">Type</Th>
                    <Th>Case</Th>
                    <Th>Risk</Th>
                    <Th align="right">When</Th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child_td]:border-b-0">
                  {recent.data.map((r) => (
                    <tr key={r.entity_id} onClick={() => router.push(`/subscribers/${r.entity_id}`)} className={rowClass()}>
                      <Td>
                        {r.type === "imei" ? "IMEI " : ""}
                        {localMsisdn(r.identifier)}
                      </Td>
                      <Td>{r.type === "wallet" ? `Wallet · ${r.name}` : r.name}</Td>
                      <Td clip={false} className="px-0">
                        <Badge label={RECENT_TYPE[r.type] ?? r.type} tone="neutral" />
                      </Td>
                      <Td>
                        {r.case_id ? (
                          <Link href={`/cases/${r.case_id}`} onClick={(e) => e.stopPropagation()} className="rounded font-mono text-mono-m text-text-primary hover:underline">
                            {r.case_id}
                          </Link>
                        ) : (
                          <span className="text-text-tertiary">–</span>
                        )}
                      </Td>
                      <Td clip={false}>
                        <RiskScore score={r.risk_score} />
                      </Td>
                      <Td align="right">{formatClockOrDay(r.at, now)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Card>
          <Card title="My watchlist" aside={watch ? <CardMeta>{watch.data.length}</CardMeta> : undefined} className="w-[324px] shrink-0">
            <ul className="flex flex-col">
              {watch?.data.map((w) => (
                <li key={w.id} className="flex items-center gap-3 border-b border-border-default py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-s text-text-primary">{localMsisdn(w.identifier)}</span>
                    <span className="truncate text-caption text-text-secondary">{watchDetail(w)}</span>
                  </span>
                  <Badge label={w.status === "hit" ? "Active" : "Watching"} tone={w.status === "hit" ? "critical" : "medium"} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </PageBody>

      {dialog === "bulk" && <BulkLookupModal onClose={() => setDialog(null)} />}
      {dialog === "request" && submitted && <RequestInfoModal identifier={localMsisdn(submitted)} operator={result?.other_operator ?? null} onClose={() => setDialog(null)} />}
    </>
  );
}
