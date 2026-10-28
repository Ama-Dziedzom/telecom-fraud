"use client";

import { RequestError } from "@/components/auth/RequestError";
import { hitSubtitle } from "@/components/lookup/LookupModals";
import { Button } from "@/components/ui/Button";
import { CheckCard, OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { FieldLabel, Select, TextArea, TextField } from "@/components/ui/TextField";
import { apiFetch } from "@/lib/api/client";
import { useApi, type SearchResult } from "@/lib/api/fd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

const REPORTED = [
  ["care_100", "Customer called care (100)"],
  ["branch", "Walked into a branch"],
  ["agent", "Reported by an agent"],
  ["police", "Police or regulator request"],
  ["internal", "Spotted by a colleague"],
] as const;

const FRAUD_TYPES = [
  ["other", "MoMo scam · social engineering"],
  ["sim_swap_to_momo", "SIM swap to MoMo"],
  ["account_takeover", "Account takeover"],
  ["agent_cash_out", "Agent cash-out"],
  ["sim_box_bypass", "Bypass (SIM box)"],
  ["wangiri", "Wangiri"],
] as const;

/** G10 · New case, not from an alert — opened by hand from a report; the subscriber is looked up as you type. */
export function NewCaseModal({ initialNumber = "", onClose }: { initialNumber?: string; onClose: () => void }) {
  const router = useRouter();
  const [number, setNumber] = useState(initialNumber);
  const [reported, setReported] = useState<string>(REPORTED[0][0]);
  const [fraudType, setFraudType] = useState<string>(FRAUD_TYPES[0][0]);
  const [what, setWhat] = useState("");
  const [reference, setReference] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const digits = number.replace(/\D/g, "");
  const { data: found } = useApi<SearchResult>(digits.length >= 9 ? `/search?q=${encodeURIComponent(number)}&type=msisdn` : null);
  const hit = found?.data.find((h) => h.kind === "subscriber" && h.subscriber);

  const create = async () => {
    setTried(true);
    if (digits.length < 9 || what.trim().length < 10) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await apiFetch<{ id: string }>("POST", "/cases", {
        title: FRAUD_TYPES.find(([id]) => id === fraudType)?.[1],
        fraud_type: fraudType,
        subjects: hit ? [hit.id] : [number],
        note: what,
        reported_via: reported,
        reference: reference || undefined,
      });
      router.push(`/cases/${res.id}`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title="New case"
      description="Opened by you · assigned to you"
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={create} loading={busy}>
            Create case
          </Button>
        </>
      }
    >
      <TextField
        size="lg"
        label="Subscriber number"
        required
        inputMode="tel"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="+233 24 123 4567"
        iconLeft={<Icon name="app/icon-phone-16" size={16} />}
        error={tried && digits.length < 9 ? "Enter the full number." : undefined}
      />
      {hit?.subscriber && (
        <div className="flex items-start gap-3 rounded-lg border border-success-border bg-success-bg px-4 py-3">
          <Icon name="app/icon-check-circle-success-18" size={18} className="mt-px shrink-0" />
          <span className="flex flex-col gap-0.5">
            <span className="text-label-s text-success-fg">Subscriber found · {hit.subscriber.name} (masked)</span>
            <span className="text-body-s text-text-secondary">
              {hitSubtitle(hit.subscriber)}
              {hit.open_cases ? ` · ${hit.open_cases} open ${hit.open_cases === 1 ? "case" : "cases"}` : ""}
            </span>
          </span>
        </div>
      )}
      <div className="flex gap-4">
        <Select label="How was it reported?" required value={reported} onChange={(e) => setReported(e.target.value)}>
          {REPORTED.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </Select>
        <Select label="Fraud type" required value={fraudType} onChange={(e) => setFraudType(e.target.value)}>
          {FRAUD_TYPES.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </Select>
      </div>
      <TextArea
        label="What happened?"
        required
        rows={3}
        value={what}
        onChange={(e) => setWhat(e.target.value)}
        error={tried && what.trim().length < 10 ? "Say what the reporter told you." : undefined}
      />
      <TextField size="lg" label="Reference from the reporter (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
      <RequestError error={failure} />
    </Modal>
  );
}

const LOOK_AT = [
  { id: "agents", title: "Agents", detail: "Who does SIM swaps and cash-outs" },
  { id: "wallets", title: "Wallets", detail: "MoMo accounts" },
  { id: "sims", title: "SIMs", detail: "Numbers and SIM cards" },
  { id: "devices", title: "Devices", detail: "By IMEI" },
] as const;

/** A prospect’s rule. `metric` and `operator` are codes; the app writes the sentence. */
export type ProspectRule = {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
  area: string;
  period_days: number;
};

const METRICS: Record<string, { label: string; chart: string }> = {
  sim_swaps_per_day: { label: "SIM swaps a day", chart: "swap" },
};
const OPERATORS: Record<ProspectRule["operator"], string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
};

export const metricLabel = (metric: string) => METRICS[metric]?.label ?? metric.replace(/_/g, " ");
/** “14-day swap chart” — what promoting a match brings across as evidence. */
export const ruleChart = (rule: ProspectRule) => `${rule.period_days}-day ${METRICS[rule.metric]?.chart ?? ""} chart`.replace(/ {2}/, " ");
/** “SIM swaps per day > 5, Kasoa, last 14 days” */
export const ruleText = (rule: ProspectRule) =>
  `${metricLabel(rule.metric)} ${OPERATORS[rule.operator] ?? rule.operator} ${rule.value}, ${rule.area}, last ${rule.period_days} days`;

/** Signals the rule can use: the app writes the words, the API gets codes and numbers. */
const SIGNALS: Array<{
  id: string;
  label: string;
  rule: Pick<ProspectRule, "metric" | "operator" | "value">;
}> = [
  {
    id: "swaps_gt_5",
    label: "SIM swaps a day, more than 5",
    rule: { metric: "sim_swaps_per_day", operator: "gt", value: 5 },
  },
  {
    id: "swaps_gt_10",
    label: "SIM swaps a day, more than 10",
    rule: { metric: "sim_swaps_per_day", operator: "gt", value: 10 },
  },
  {
    id: "swaps_gte_3",
    label: "SIM swaps a day, 3 or more",
    rule: { metric: "sim_swaps_per_day", operator: "gte", value: 3 },
  },
];
const AREAS = ["Kasoa", "Accra Central", "Adum, Kumasi", "Tema", "Takoradi", "Tamale", "Ho"];
const PERIODS = [7, 14, 30];

/** G11 · Start a prospect — a hunch and a rule, with a live count of what matches. */
export function ProspectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [hunch, setHunch] = useState("");
  const [lookAt, setLookAt] = useState<string>("agents");
  const [signal, setSignal] = useState(SIGNALS[0].id);
  const [area, setArea] = useState(AREAS[0]);
  const [period, setPeriod] = useState(14);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const { data: preview } = useApi<{ look_at: string; matches: number }>(`/prospects/preview?look_at=${lookAt}&area=${encodeURIComponent(area)}`);
  const noun = LOOK_AT.find((l) => l.id === lookAt)!.title.toLowerCase();

  const start = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const rule: ProspectRule = {
        ...SIGNALS.find((x) => x.id === signal)!.rule,
        area,
        period_days: period,
      };
      const res = await apiFetch<{ id: string }>("POST", "/prospects", {
        hunch: hunch || "Untitled hunch",
        look_at: lookAt,
        rule,
      });
      router.push(`/prospect/${res.id}`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title="Start a prospect"
      description="Hunt for fraud before an alert fires. Nothing changes for customers while you look."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={start} loading={busy} disabled={!hunch.trim()}>
            Start prospect
          </Button>
        </>
      }
    >
      <TextField size="lg" label="What’s your hunch?" value={hunch} onChange={(e) => setHunch(e.target.value)} placeholder="Kasoa agents doing far more SIM swaps than usual" />
      <fieldset className="flex flex-col">
        <legend className="mb-2">
          <FieldLabel>Look at</FieldLabel>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {LOOK_AT.map((l) => (
            <OptionCard
              key={l.id}
              name="look_at"
              checked={lookAt === l.id}
              onChange={() => setLookAt(l.id)}
              title={l.title}
              description={<span className="block truncate">{l.detail}</span>}
              indent
              className="min-w-0 px-3.5 py-2.5"
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col">
        <legend className="mb-2">
          <FieldLabel>Find ones where</FieldLabel>
        </legend>
        <div className="grid grid-cols-3 gap-2.5">
          <Select label="Signal" value={signal} onChange={(e) => setSignal(e.target.value)}>
            {SIGNALS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </Select>
          <Select label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
          <Select label="Period" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {PERIODS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </Select>
        </div>
      </fieldset>
      <p className="flex items-center gap-2.5 rounded-lg border border-info-border bg-info-bg px-4 py-3 text-body-s text-info-fg" aria-live="polite">
        <Icon name="app/icon-info-info-20" size={16} />
        {preview ? `${preview.matches} ${preview.matches === 1 ? noun.replace(/s$/, "") : noun} match right now` : "Counting matches…"}
      </p>
      <RequestError error={failure} />
    </Modal>
  );
}

/** G5 · Save this view. */
export function SaveViewModal({
  summary,
  filters,
  onSaved,
  onClose,
}: {
  summary: string;
  filters: Record<string, unknown>;
  onSaved?: (view: { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [name, setName] = useState(summary);
  const [shared, setShared] = useState(false);
  const [byDefault, setByDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const view = await apiFetch<{ id: string; name: string }>("POST", "/views", { name, shared, default: byDefault, filters });
      await mutate("/views");
      // G5b · the new view is in the sidebar under Saved views.
      toast({
        tone: "success",
        title: "View saved",
        body: `It’s in your sidebar under Saved views. ${shared ? "Your team can use it too." : "Only you can see it."}`,
      });
      onSaved?.(view);
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
      width={420}
      title="Save this view"
      description={summary || "Current filters"}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={save} loading={busy} disabled={!name.trim()}>
            Save view
          </Button>
        </>
      }
    >
      <TextField size="lg" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="High-risk SIM swaps · Ashanti" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>Who can use it</FieldLabel>
        </legend>
        <OptionCard name="shared" checked={!shared} onChange={() => setShared(false)} title="Only me" />
        <OptionCard name="shared" checked={shared} onChange={() => setShared(true)} title="My team" description="Your fraud team" indent />
      </fieldset>
      <CheckCard title="Open Cases with this view by default" checked={byDefault} onChange={(e) => setByDefault(e.target.checked)} />
      <RequestError error={failure} />
    </Modal>
  );
}

/** G6 · Add a note to all — the same note on every selected case. */
export function BulkNoteModal({ caseIds, onDone, onClose }: { caseIds: string[]; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await apiFetch<{
        added: number;
        failed: Array<{ id: string }>;
      }>("POST", "/cases/notes", {
        case_ids: caseIds,
        body,
        visibility: "internal",
      });
      await mutate((key) => typeof key === "string" && /^\/cases\/[^/?]+\/timeline/.test(key));
      toast({
        tone: res.failed.length ? undefined : "success",
        title: `Note added to ${res.added} ${res.added === 1 ? "case" : "cases"}`,
        body: res.failed.length ? `Not added to ${res.failed.map((f) => f.id).join(", ")}.` : undefined,
      });
      onDone();
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
      title={`Add a note to ${caseIds.length} ${caseIds.length === 1 ? "case" : "cases"}`}
      description={caseIds.join(" · ")}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={add} loading={busy} disabled={!body.trim()}>
            Add note
          </Button>
        </>
      }
    >
      <TextArea label="Note" required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <RequestError error={failure} />
    </Modal>
  );
}
