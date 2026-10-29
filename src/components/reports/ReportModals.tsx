"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Chip, SegmentChips } from "@/components/reports/Insights";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CheckCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, Select, TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type PersonRef } from "@/lib/api/fd";
import { roleLabel } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatClock, formatDay, TZ } from "@/lib/time";
import { useId, useState } from "react";
import { useSWRConfig } from "swr";

export const TEMPLATES = [
  { id: "case_list", label: "Case list", detail: "Your cases with outcome and loss", option: "Case list · my cases" },
  { id: "fraud_summary", label: "Fraud summary", detail: "Trends, mix and recovery", option: "Fraud summary · MTN Ghana" },
  { id: "regulator_return", label: "Regulator return", detail: "BoG format, pre-filled", option: "Regulator return · BoG" },
  { id: "rule_performance", label: "Rule performance", detail: "Hits, precision, false-positive notes", option: "Rule performance" },
] as const;

/** A report as GET /reports and GET /reports/{id} send it. */
export type Report = {
  id: string;
  name: string;
  template: string;
  schedule: Schedule | null;
  next_run_at: string | null;
  status: "ready" | "building" | "failed";
  progress_pct: number | null;
  error: { code: string; at: string } | null;
  last_run_at: string;
  format: "pdf" | "csv" | "xlsx";
  owner: PersonRef;
  shared_with: Array<{ type: "user" | "group"; id: string; name: string; initials?: string }>;
};

type Schedule = { frequency: "daily" | "weekly" | "monthly"; day_of_week?: string; day_of_month?: number; time: string; paused: boolean };

const TEMPLATE_LABEL: Record<string, string> = { case_list: "Case list", fraud_summary: "Summary", fraud_type: "Fraud type", regulator_return: "Regulatory", rule_performance: "Rules" };
export const templateLabel = (t: string) => TEMPLATE_LABEL[t] ?? t.replace(/_/g, " ");

/** PDF · CSV · Excel */
export const formatLabel = (f: string) => (f === "xlsx" ? "Excel" : f.toUpperCase());

const WEEKDAY: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** Every Mon 07:00 · 1st of month · One-off */
export function scheduleLabel(s: Schedule | null) {
  if (!s) return "One-off";
  if (s.frequency === "weekly") return `Every ${WEEKDAY[s.day_of_week ?? ""] ?? s.day_of_week} ${s.time}`;
  if (s.frequency === "monthly") return `${ordinal(s.day_of_month ?? 1)} of month`;
  return `Every day ${s.time}`;
}

/** “Efua O.-A. +3”, or “Only me”. Groups keep their name. */
export function sharedLabel(list: Report["shared_with"]) {
  if (!list.length) return "Only me";
  const [first, ...rest] = list;
  const [given, ...family] = first.name.split(" ");
  const short = first.type === "group" || !family.length ? first.name : `${given} ${family.join(" ").split("-").map((p) => `${p[0]}.`).join("-")}`;
  return rest.length ? `${short} +${rest.length}` : short;
}

/** Mon 2 Nov, 07:00 */
export const nextRunLabel = (iso: string) => `${formatDay(Date.parse(iso))}, ${formatClock(iso)}`;

/** The schedule a choice in the form stands for. */
const SCHEDULES: Record<string, Omit<Schedule, "time" | "paused">> = {
  week_mon: { frequency: "weekly", day_of_week: "mon" },
  week_fri: { frequency: "weekly", day_of_week: "fri" },
  month_1: { frequency: "monthly", day_of_month: 1 },
};

/** How far back a scheduled report looks, in days. */
const COVERS = [
  ["7", "The previous 7 days"],
  ["30", "The previous 30 days"],
  ["90", "The previous 90 days"],
] as const;

const INCLUDE = [
  ["open", "Open"],
  ["closed_fraud", "Closed as fraud"],
  ["closed_fp", "Closed as false positive"],
  ["inconclusive", "Inconclusive"],
] as const;

const FORMATS: Array<{ id: Report["format"]; label: string }> = [
  { id: "pdf", label: "PDF" },
  { id: "csv", label: "CSV" },
  { id: "xlsx", label: "Excel" },
];

/** GET /people/report-recipients. */
type Person = PersonRef & { role: string; can_view_cases: boolean };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** `20 Oct 2026` from `2026-10-20` (no timezone shifts). */
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
/** `2026-10-20`, today in Accra. */
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const minusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** H7/H9 · Date field — select chrome (40, chevron) over a native date input; error turns the border red with a message under. */
function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <span
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-lg bg-surface-base px-3 focus-within:shadow-focus",
          error ? "border-[1.5px] border-critical-fg" : "border border-border-default hover:border-border-strong focus-within:border-[1.5px] focus-within:border-border-focus",
        )}
      >
        <span className={cn("flex-1 text-body-m", error ? "text-text-tertiary" : "text-text-primary")}>{day(value)}</span>
        <Icon name="app/icon-chevron-down-16" size={16} />
        <input
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </span>
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-caption text-critical-fg">
          <Icon name="icon-alert-critical" size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** H7/H8/H9 · New report — generate once, or put it on a schedule. */
export function NewReportModal({ template = "case_list", schedule: startScheduled = false, onClose }: { template?: string; schedule?: boolean; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data: people } = useApi<{ data: Person[] }>("/people/report-recipients");
  const [type, setType] = useState(template);
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-20");
  const [covers, setCovers] = useState<string>("7");
  const [include, setInclude] = useState<Set<string>>(new Set(["open", "closed_fraud", "closed_fp"]));
  const [format, setFormat] = useState<Report["format"]>("csv");
  const [repeat, setRepeat] = useState(startScheduled);
  const [every, setEvery] = useState("week_mon");
  const [at, setAt] = useState("07:00");
  const [recipients, setRecipients] = useState<string[]>(["usr_efua", "usr_nana"]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const dateError = !repeat && to < from ? `Must be on or after the start date (${day(from).split(" ").slice(0, 2).join(" ")})` : undefined;
  const label = TEMPLATES.find((t) => t.id === type)?.option ?? "Report";
  const name = type === "case_list" && !repeat ? `My cases · ${Number(from.slice(8))}-${Number(to.slice(8))} ${day(to).split(" ")[1]}` : label;

  const go = async () => {
    if (dateError) return;
    setBusy(true);
    setFailure(null);
    // A schedule looks back from each run; the API takes a concrete window, so send the first one.
    const window = repeat ? { from: minusDays(todayIso(), Number(covers)), to: todayIso() } : { from, to };
    try {
      const created = await apiFetch<Report>("POST", "/reports", {
        template: type,
        name,
        format,
        filters: { ...window, include: Array.from(include) },
        schedule: repeat ? { ...SCHEDULES[every], time: at, paused: false } : undefined,
        share_with: repeat ? recipients : undefined,
      });
      await mutate((k) => typeof k === "string" && k.startsWith("/reports"));
      toast(
        repeat
          ? { tone: "success", title: "Schedule saved", body: created.next_run_at ? `${created.name} · next run ${nextRunLabel(created.next_run_at)}` : created.name }
          : { title: `Generating “${created.name}”`, body: "About 1 minute. We’ll tell you when it’s ready." },
      );
      onClose();
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={repeat ? "Schedule a report" : "New report"}
      description={repeat ? "Runs automatically. Pause or edit it from Reports, Scheduled." : "Pick what to include. Large reports run in the background, so you can keep working."}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={go} loading={busy} disabled={Boolean(dateError) || !include.size}>
            {repeat ? "Save schedule" : "Generate report"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Select label="Report type" value={type} onChange={(e) => setType(e.target.value)}>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.option}
            </option>
          ))}
        </Select>
        {repeat ? (
          <Select label="Covers" value={covers} onChange={(e) => setCovers(e.target.value)}>
            {COVERS.map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex items-start gap-3">
            <DateField label="From" value={from} onChange={setFrom} />
            <DateField label="To" value={to} onChange={setTo} error={dateError} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <FieldLabel>Include</FieldLabel>
          <div role="group" aria-label="Include" className="flex flex-wrap gap-2">
            {INCLUDE.map(([id, text]) => {
              const on = include.has(id);
              return (
                <Chip
                  key={id}
                  selected={on}
                  aria-pressed={on}
                  onClick={() =>
                    setInclude((s) => {
                      const next = new Set(s);
                      if (on) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                >
                  {text}
                </Chip>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>Format</FieldLabel>
          <SegmentChips label="Format" value={format} onChange={setFormat} options={FORMATS} />
        </div>
        <CheckCard title="Repeat on a schedule" description="Delivered to your inbox and kept here" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
        {repeat && (
          <>
            <div className="flex gap-3">
              <Select label="Every" value={every} onChange={(e) => setEvery(e.target.value)}>
                <option value="week_mon">Week · Monday</option>
                <option value="week_fri">Week · Friday</option>
                <option value="month_1">Month · 1st</option>
              </Select>
              <Select label="At" value={at} onChange={(e) => setAt(e.target.value)}>
                {["06:00", "07:00", "08:00", "17:00"].map((t) => (
                  <option key={t} value={t}>
                    {t} GMT
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Also send to (optional)</FieldLabel>
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 focus-within:border-[1.5px] focus-within:border-border-focus focus-within:shadow-focus">
                {recipients.map((id) => {
                  const p = people?.data.find((x) => x.id === id);
                  return (
                    <span key={id} className="flex items-center gap-1 rounded-md bg-surface-sunken py-0.5 pr-1 pl-2 text-body-s text-text-primary">
                      {p?.name ?? id}
                      <button type="button" aria-label={`Remove ${p?.name ?? id}`} onClick={() => setRecipients((r) => r.filter((x) => x !== id))} className="flex rounded p-0.5 hover:bg-surface-raised">
                        <Icon name="app/icon-x-primary-18" size={12} />
                      </button>
                    </span>
                  );
                })}
                <select
                  aria-label="Add people"
                  value=""
                  onChange={(e) => e.target.value && setRecipients((r) => [...r, e.target.value])}
                  className="min-w-[120px] flex-1 cursor-pointer appearance-none bg-transparent text-body-m text-text-tertiary outline-none focus-visible:shadow-none"
                >
                  <option value="">Add people…</option>
                  {people?.data
                    .filter((p) => p.can_view_cases && !recipients.includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <p className="flex items-start gap-1.5 text-caption text-text-secondary">
                <Icon name="icon-info-secondary" size={14} className="mt-0.5 shrink-0" />
                Only people in MTN Ghana with access to these cases can receive it.
              </p>
            </div>
          </>
        )}
        <RequestError error={failure} />
      </div>
    </Modal>
  );
}

/** H14 · Share a report — people who can’t see case data can’t receive it. */
export function ShareReportModal({ id, name, meta, onClose }: { id: string; name: string; meta: string; onClose: () => void }) {
  const toast = useToast();
  const { data: people } = useApi<{ data: Person[] }>("/people/report-recipients");
  const [picked, setPicked] = useState<string[]>(["usr_efua", "usr_kofi", "usr_esi"]);
  const [q, setQ] = useState("");
  const [expires, setExpires] = useState<"1" | "7" | "30">("7");
  const [message, setMessage] = useState("For Thursday’s review.");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const chosen = picked.map((pid) => people?.data.find((p) => p.id === pid)).filter(Boolean) as Person[];
  const blocked = chosen.filter((p) => !p.can_view_cases);
  const allowed = chosen.length - blocked.length;
  const matches = q ? (people?.data ?? []).filter((p) => !picked.includes(p.id) && p.name.toLowerCase().includes(q.toLowerCase())) : [];
  const first = (p: Person) => p.name.split(" ")[0];
  const removeBlocked = () => setPicked((x) => x.filter((pid) => !blocked.some((b) => b.id === pid)));

  const share = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await apiFetch<{ shared_with: number; expires_at: string }>("POST", `/reports/${id}/share`, { user_ids: picked, expires_in_days: Number(expires), message });
      toast({ tone: "success", title: `Shared with ${picked.length}`, body: `Link expires in ${expires === "1" ? "24 hours" : `${expires} days`} · logged to the audit trail.` });
      onClose();
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title={`Share “${name}”`}
      description={meta}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={share} loading={busy} disabled={blocked.length > 0 || !picked.length}>
            Share with {allowed}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="relative flex flex-col gap-1.5">
          <FieldLabel htmlFor="share-search">Add people</FieldLabel>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 hover:border-border-strong focus-within:border-[1.5px] focus-within:border-border-focus focus-within:shadow-focus">
            <Icon name="app/icon-search-tertiary-16" size={16} />
            <input
              id="share-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people in MTN Ghana"
              className="min-w-0 flex-1 bg-transparent text-body-m outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
            />
          </label>
          {matches.length > 0 && (
            <ul className="absolute top-full right-0 left-0 z-10 mt-1 rounded-lg border border-border-default bg-surface-base p-1 shadow-lg">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked((x) => [...x, p.id]);
                      setQ("");
                    }}
                    className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-surface-sunken"
                  >
                    <span className="text-label-s text-text-primary">{p.name}</span>
                    <span className="text-caption text-text-secondary">{roleLabel(p.role)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {chosen.length > 0 && (
          <ul className="flex flex-col">
            {chosen.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-border-default py-2 last:border-b-0">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label-s text-text-primary">{p.name}</span>
                  <span className="truncate text-caption text-text-secondary">{p.can_view_cases ? roleLabel(p.role) : `${roleLabel(p.role)} · can’t see case data`}</span>
                </span>
                {p.can_view_cases ? <Badge label="Can view" tone="neutral" /> : <Badge label="No access" tone="critical" />}
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setPicked((x) => x.filter((y) => y !== p.id))}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken"
                >
                  <Icon name="app/icon-x-primary-18" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {blocked.length > 0 && (
          <Banner
            tone="error"
            title={blocked.length === 1 ? `${first(blocked[0])} can’t receive this report` : `${blocked.length} people can’t receive this report`}
            action={
              <button type="button" onClick={removeBlocked} className="shrink-0 rounded text-label-s text-text-brand hover:underline">
                Remove {blocked.length === 1 ? first(blocked[0]) : "them"}
              </button>
            }
          >
            {blocked.length === 1 ? `${roleLabel(blocked[0].role)} can’t see case data. Remove ${first(blocked[0])} to share.` : "They can’t see case data. Remove them to share."}
          </Banner>
        )}
        <div className="flex flex-col gap-2">
          <FieldLabel>Link expires</FieldLabel>
          <SegmentChips
            label="Link expires"
            value={expires}
            onChange={setExpires}
            options={[
              { id: "1", label: "24 hours" },
              { id: "7", label: "7 days" },
              { id: "30", label: "30 days" },
            ]}
          />
        </div>
        <TextArea label="Message (optional)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        <RequestError error={failure} />
      </div>
    </Modal>
  );
}
