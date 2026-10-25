"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { FieldLabel, Select, TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type PersonRef } from "@/lib/api/fd";
import { roleLabel } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatClock, formatDay } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

export const TEMPLATES = [
  { id: "case_list", label: "Case list", detail: "Your cases with outcome & loss", icon: "app/icon-folder-brand-20", option: "Case list · my cases" },
  { id: "fraud_summary", label: "Fraud summary", detail: "Trends, mix and recovery", icon: "app/icon-chart-brand-18", option: "Fraud summary · Kasa Mobile" },
  { id: "regulator_return", label: "Regulator return", detail: "BoG format, pre-filled", icon: "app/icon-file-brand-20", option: "Regulator return · BoG" },
  { id: "rule_performance", label: "Rule performance", detail: "Hits, precision, FP notes", icon: "app/icon-sliders-brand-22", option: "Rule performance" },
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

export const formatLabel = (f: string) => (f === "xlsx" ? "XLSX" : f.toUpperCase());

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

/** Mon 26 Oct 07:00 */
export const nextRunLabel = (iso: string) => `${formatDay(Date.parse(iso))} ${formatClock(iso)}`;

/** The schedule a choice in the form stands for. */
const SCHEDULES: Record<string, Omit<Schedule, "time" | "paused">> = {
  week_mon: { frequency: "weekly", day_of_week: "mon" },
  week_fri: { frequency: "weekly", day_of_week: "fri" },
  month_1: { frequency: "monthly", day_of_month: 1 },
};

const INCLUDE = [
  ["open", "Open"],
  ["closed_fraud", "Closed · fraud"],
  ["closed_fp", "Closed · false positive"],
  ["inconclusive", "Inconclusive"],
] as const;

/** GET /people/report-recipients. */
type Person = PersonRef & { role: string; can_view_cases: boolean };

/** `20 Oct 2026` from `2026-10-20` (no timezone shifts). */
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
};

function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <FieldLabel required>{label}</FieldLabel>
      <label
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-lg border bg-surface-base px-3 focus-within:shadow-focus",
          error ? "border-critical-fg" : "border-border-default focus-within:border-border-focus",
        )}
      >
        <Icon name="app/icon-clock-secondary-16" size={16} />
        <span className="flex-1 text-body-m text-text-primary">{day(value)}</span>
        <Icon name="app/icon-chevron-down-16" size={16} />
        <input aria-label={label} aria-invalid={Boolean(error)} type="date" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      {error && (
        <p className="flex items-start gap-1.5 text-caption text-critical-fg">
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
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: people } = useApi<{ data: Person[] }>("/people/report-recipients");
  const [type, setType] = useState(template);
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-20");
  const [include, setInclude] = useState<Set<string>>(new Set(["open", "closed_fraud", "closed_fp"]));
  const [format, setFormat] = useState<"pdf" | "csv" | "xlsx">("csv");
  const [repeat, setRepeat] = useState(startScheduled);
  const [every, setEvery] = useState("week_mon");
  const [at, setAt] = useState("07:00");
  const [recipients, setRecipients] = useState<string[]>(["usr_efua", "usr_nana"]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const dateError = to < from ? `End date is before the start date. Pick a date on or after ${day(from)}.` : undefined;
  const label = TEMPLATES.find((t) => t.id === type)?.option ?? "Report";
  const name = type === "case_list" ? `My cases · ${Number(from.slice(8))}-${Number(to.slice(8))} ${day(to).split(" ")[1]}` : label;

  const go = async () => {
    if (dateError) return;
    setBusy(true);
    setFailure(null);
    try {
      const created = await apiFetch<Report>("POST", "/reports", {
        template: type,
        name,
        format,
        filters: { from, to, include: Array.from(include) },
        schedule: repeat ? { ...SCHEDULES[every], time: at, paused: false } : undefined,
        share_with: repeat ? recipients : undefined,
      });
      await mutate((k) => typeof k === "string" && k.startsWith("/reports"));
      toast(
        repeat
          ? { tone: "success", title: "Schedule saved", body: created.next_run_at ? `${name} · next run ${nextRunLabel(created.next_run_at)}` : name }
          : { title: `Generating “${name}”`, body: "About 1 minute. We’ll notify you when it’s ready.", action: { label: "View", onClick: () => router.push("/reports") } },
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
      width={600}
      icon={repeat ? "app/icon-clock-brand-24" : "app/icon-file-brand-20"}
      tone="brand"
      title={repeat ? "Schedule a report" : "New report"}
      description={repeat ? "Runs automatically. You can pause or edit it from Reports › Scheduled." : "Pick what to include. Large reports run in the background. You can keep working."}
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
      <Select label="Report type" required value={type} onChange={(e) => setType(e.target.value)}>
        {TEMPLATES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.option}
          </option>
        ))}
      </Select>
      <div className="flex gap-4">
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} error={dateError} />
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>Include</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {INCLUDE.map(([id, text]) => {
            const on = include.has(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setInclude((s) => {
                    const next = new Set(s);
                    if (on) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3 text-label-s",
                  on ? "border-brand-primary bg-brand-primary-subtle text-text-brand" : "border-border-default text-text-secondary",
                )}
              >
                {on && <Icon name="app/icon-check-brand-22" size={12} />}
                {text}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>Format</FieldLabel>
        <div className="w-fit">
          <Segmented
            label="Format"
            value={format}
            onChange={setFormat}
            options={[
              { id: "pdf", label: "PDF" },
              { id: "csv", label: "CSV" },
              { id: "xlsx", label: "Excel" },
            ]}
          />
        </div>
      </div>
      <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3", repeat ? "bg-brand-primary-subtle" : "bg-surface-raised")}>
        <span className="flex flex-1 flex-col">
          <span className="text-label-m text-text-primary">Repeat on a schedule</span>
          <span className="text-caption text-text-secondary">Delivered to your inbox and kept here.</span>
        </span>
        <span className="relative flex h-5 w-9 shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
            className="peer h-5 w-9 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors checked:bg-brand-primary focus-visible:shadow-focus"
          />
          <span className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-surface-base shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
      {repeat && (
        <>
          <div className="flex gap-4">
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
            <FieldLabel optional>Also send to</FieldLabel>
            <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border-default px-2 py-1.5">
              {recipients.map((id) => {
                const p = people?.data.find((x) => x.id === id);
                return (
                  <span key={id} className="flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-0.5 text-caption text-text-primary">
                    {p?.name ?? id}
                    <button type="button" aria-label={`Remove ${p?.name}`} onClick={() => setRecipients((r) => r.filter((x) => x !== id))} className="flex rounded">
                      <Icon name="app/icon-x-primary-18" size={12} />
                    </button>
                  </span>
                );
              })}
              <select
                aria-label="Add people"
                value=""
                onChange={(e) => e.target.value && setRecipients((r) => [...r, e.target.value])}
                className="min-w-[120px] flex-1 bg-transparent text-body-s text-text-tertiary outline-none focus-visible:shadow-none"
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
            <p className="text-caption text-text-secondary">Only people in Kasa Mobile with access to these cases can receive it.</p>
          </div>
        </>
      )}
      <RequestError error={failure} />
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
  const matches = q ? (people?.data ?? []).filter((p) => !picked.includes(p.id) && p.name.toLowerCase().includes(q.toLowerCase())) : [];

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
      width={600}
      icon="app/icon-users-brand-18"
      tone="brand"
      title={`Share “${name}”`}
      description={meta}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={share} loading={busy} disabled={blocked.length > 0 || !picked.length} iconLeft={<Icon name="app/icon-send-white-18" size={18} />}>
            Share with {picked.length - blocked.length || picked.length}
          </Button>
        </>
      }
    >
      <div className="relative flex flex-col gap-1.5">
        <FieldLabel>Add people</FieldLabel>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border-default px-3 focus-within:border-border-focus focus-within:shadow-focus">
          <Icon name="app/icon-search-18" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people in Kasa Mobile" className="min-w-0 flex-1 bg-transparent text-body-m outline-none focus-visible:shadow-none" />
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
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body-s hover:bg-surface-raised"
                >
                  <Avatar initials={p.initials} />
                  {p.name}
                  <span className="text-caption text-text-tertiary">{roleLabel(p.role)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {chosen.map((p) => (
          <li key={p.id} className={cn("flex items-center gap-3 rounded-[10px] border px-3 py-2", p.can_view_cases ? "border-border-subtle" : "border-critical-border bg-critical-bg")}>
            <Avatar initials={p.initials} />
            <span className="flex flex-1 flex-col">
              <span className="text-label-m text-text-primary">{p.name}</span>
              <span className={cn("text-caption", p.can_view_cases ? "text-text-secondary" : "text-critical-fg")}>{p.can_view_cases ? roleLabel(p.role) : `${roleLabel(p.role)} · can’t see case data`}</span>
            </span>
            {p.can_view_cases ? (
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPicked((x) => x.filter((y) => y !== p.id))} className="flex rounded">
                <Icon name="app/icon-x-primary-18" size={14} />
              </button>
            ) : (
              <button type="button" onClick={() => setPicked((x) => x.filter((y) => y !== p.id))} className="rounded text-label-s text-critical-fg hover:underline">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <FieldLabel>Link expires</FieldLabel>
        <div className="w-fit">
          <Segmented
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
      </div>
      <TextArea label="Message" optional rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
      {blocked.length > 0 && (
        <p role="alert" className="text-caption text-critical-fg">
          Remove {blocked.map((p) => p.name.split(" ")[0]).join(", ")} to share: {blocked.length === 1 ? "they can’t" : "they can’t"} see case data.
        </p>
      )}
      <RequestError error={failure} />
    </Modal>
  );
}
