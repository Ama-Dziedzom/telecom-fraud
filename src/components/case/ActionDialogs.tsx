"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCard, Checkbox, OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, Select, TextArea, TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useAgent, useCaseTransactions, useColleagues, useEvidence, type CaseDetail, type Colleague, type EscalationTarget, type Transaction } from "@/lib/api/cases";
import { fraudTypeLabel } from "@/lib/api/fd";
import { roleLabel } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, now as appNow } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Chips, DetailRows, StatTile, firstName, localMsisdn, table } from "./parts";

/** Busy/error state + refresh the case afterwards, the same for every dialog. */
function useCaseSubmit(caseId: string) {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await fn();
      await Promise.all([mutate(`/cases/${caseId}`), mutate(`/cases/${caseId}/timeline`)]);
      return true;
    } catch (err) {
      setFailure(err);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, failure, run };
}

// ─── D7 · Log a call with the subscriber ──────────────────────────────────

const OUTCOMES: Array<["reached" | "no_answer" | "wrong_number" | "call_back_later", string]> = [
  ["reached", "Reached"],
  ["no_answer", "No answer"],
  ["wrong_number", "Wrong person"],
  ["call_back_later", "Call back later"],
];

type Answer = "yes" | "no" | "unsure";
const ANSWERS: Array<[Answer, string]> = [
  ["yes", "Yes"],
  ["no", "No"],
  ["unsure", "Not sure"],
];
const LANGUAGES = ["Twi", "English", "Ga", "Ewe", "Fante", "Hausa"];

export function CallLogModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const contact = detail.contact;
  const alt = contact?.alt_msisdn ?? null;
  const [number, setNumber] = useState<"alternate" | "registered">(alt ? "alternate" : "registered");
  // `language` lists what the subscriber speaks (“Twi, English”); the first is the default.
  const spoken = contact?.language?.split(/,\s*/)[0];
  const [language, setLanguage] = useState(LANGUAGES.includes(spoken ?? "") ? spoken! : "English");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number][0]>("reached");
  const transfers = detail.what_happened.find((s) => s.kind === "payments_out")?.label.match(/\d+/)?.[0];
  const questions = [
    { id: "asked_for_new_sim", text: "Did they ask for the SIM swap?" },
    { id: "made_transfers", text: transfers ? `Do they recognise the ${transfers} transfers?` : "Do they recognise the transfers?" },
    { id: "asked_for_pin", text: "Has anyone asked for their PIN or ID recently?" },
  ];
  const [answers, setAnswers] = useState<Array<{ checked: boolean; answer: Answer | null }>>(questions.map(() => ({ checked: false, answer: null })));
  const [summary, setSummary] = useState("");
  const [tried, setTried] = useState(false);

  const save = async () => {
    setTried(true);
    if (!summary.trim()) return;
    const ok = await run(async () => {
      // TODO(api): 0.2 has no field for which number was called; the summary should say.
      await apiFetch("POST", `/cases/${detail.id}/calls`, {
        outcome,
        language: language.toLowerCase(),
        answers: outcome === "reached" ? questions.flatMap((q, i) => (answers[i].checked && answers[i].answer ? [{ question_id: q.id, answer: answers[i].answer }] : [])) : [],
        note: summary,
      });
    });
    if (ok) {
      toast({ tone: "success", title: "Call logged", body: outcome === "reached" ? "It’s on the timeline. Next: request a reversal." : "It’s on the timeline." });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title="Log a call"
      description={`${detail.id} · ${detail.subject.name} · ${formatClock(appNow())}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={save} loading={busy}>
            Save call log
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <Select label="Number called" value={number} onChange={(e) => setNumber(e.target.value as typeof number)}>
          {alt && <option value="alternate">{alt} · alternate</option>}
          <option value="registered">{localMsisdn(contact?.registered ?? detail.subject.msisdn)} · registered</option>
        </Select>
        <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>Outcome</FieldLabel>
        <Chips label="Outcome" value={outcome} onChange={setOutcome} options={OUTCOMES} />
      </div>
      {outcome === "reached" && (
        <div className="flex flex-col gap-2">
          <FieldLabel>What they said</FieldLabel>
          {questions.map((q, i) => (
            <CheckCard
              key={q.id}
              checked={answers[i].checked}
              onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
              title={q.text}
              description={
                answers[i].checked ? (
                  <span role="radiogroup" aria-label={`Answer: ${q.text}`} className="mt-1 flex gap-1.5" onClick={(e) => e.preventDefault()}>
                    {ANSWERS.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={answers[i].answer === id}
                        onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? { ...x, answer: id } : x)))}
                        className={cn(
                          "h-7 rounded-lg border px-2.5 text-label-s",
                          answers[i].answer === id ? "border-brand-primary-subtle-hover bg-surface-base text-text-brand" : "border-border-default bg-surface-base text-text-primary",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                ) : (
                  "Tick when asked"
                )
              }
            />
          ))}
        </div>
      )}
      <TextArea
        label="Summary"
        rows={3}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder={`What did ${firstName(detail.subject.name)} say?`}
        error={tried && !summary.trim() ? "Add a short summary: it goes on the case record." : undefined}
      />
      <RequestError error={failure} />
    </Modal>
  );
}

// ─── D8 · Request reversal from MoMo ops ──────────────────────────────────

const WHERE: Record<string, { label: (t: Transaction) => string; tone: "medium" | "critical" | "success"; recoverable: boolean }> = {
  agent_holds: { label: () => "Cashed out · agent holds it", tone: "medium", recoverable: true },
  cashed_out: { label: (t) => `Cashed out ${formatClock(Date.parse(t.at) + 12 * 60_000)}`, tone: "critical", recoverable: false },
  in_wallet: { label: () => "Still in the wallet", tone: "success", recoverable: true },
};

export function ReversalModal({ detail, preselect, onClose }: { detail: CaseDetail; preselect?: Transaction[]; onClose: () => void }) {
  const toast = useToast();
  const { data } = useCaseTransactions(detail.id);
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const rows = (data?.data ?? []).filter((t) => t.flagged && t.direction === "out");
  const [picked, setPicked] = useState<Set<string> | null>(preselect ? new Set(preselect.map((t) => t.id)) : null);
  // Default: everything that can still be recovered.
  const chosen = picked ?? new Set(rows.filter((t) => WHERE[t.where_now ?? "in_wallet"]?.recoverable).map((t) => t.id));
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  const sum = (ts: Transaction[]) => ts.reduce((s, t) => s + t.amount.amount_minor, 0);
  const requested = rows.filter((t) => chosen.has(t.id));
  const likely = requested.filter((t) => t.where_now === "in_wallet");
  const gone = rows.filter((t) => t.where_now === "cashed_out");
  const all = rows.length > 0 && requested.length === rows.length;
  const wallets = new Set(likely.map((t) => t.counterparty)).size;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
  };

  const send = async () => {
    setTried(true);
    if (!note.trim() || !requested.length) return;
    const ok = await run(async () => {
      await apiFetch("POST", `/cases/${detail.id}/reversals`, { payment_ids: requested.map((t) => t.id), note });
    });
    if (ok) {
      toast({ tone: "success", title: "Reversal requested", body: `${formatMoney(sum(requested), "GHS")} · MoMo ops usually reply within 2 hours.` });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={800}
      title="Request reversal"
      description="Goes to MoMo operations. They reply within 2 hours on working days."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy} disabled={!requested.length}>
            Send request · {formatMoney(sum(requested), "GHS")}
          </Button>
        </>
      }
    >
      <div className={table.wrap}>
        <table className="w-full">
          <thead>
            <tr className={table.head}>
              <th className="w-12 pl-4">
                <Checkbox
                  label="Select all"
                  hideLabel
                  checked={all}
                  indeterminate={requested.length > 0 && !all}
                  onChange={(e) => setPicked(new Set(e.target.checked ? rows.map((t) => t.id) : []))}
                />
              </th>
              <th className="w-[84px] font-normal">Time</th>
              <th className="font-normal">To</th>
              <th className="font-normal">Where the money is</th>
              <th className="pr-4 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const where = WHERE[t.where_now ?? "in_wallet"] ?? WHERE.in_wallet;
              const on = chosen.has(t.id);
              return (
                <tr key={t.id} className={cn(table.row, "text-body-s text-text-primary", on && "bg-brand-primary-subtle-hover hover:bg-brand-primary-subtle-hover")}>
                  <td className="pl-4">
                    <Checkbox label={`Select ${t.id}`} hideLabel checked={on} onChange={(e) => toggle(t.id, e.target.checked)} />
                  </td>
                  <td>{formatClock(t.at)}</td>
                  <td>{t.counterparty}</td>
                  <td>
                    <Badge label={where.label(t)} tone={where.tone} />
                  </td>
                  <td className="pr-4 text-right tabular-nums">{formatMoney(t.amount.amount_minor, t.amount.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <StatTile label="Requested" value={formatMoney(sum(requested), "GHS")} sub={`${requested.length} ${requested.length === 1 ? "transfer" : "transfers"}`} />
        <StatTile label="Likely recoverable" value={formatMoney(sum(likely), "GHS")} sub={`Still in ${wallets} ${wallets === 1 ? "wallet" : "wallets"}`} />
        <StatTile label="Already cashed out" value={formatMoney(sum(gone), "GHS")} sub="Not requested" />
      </div>
      <TextArea
        label="Note for MoMo ops"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why these payments should come back"
        error={tried && !note.trim() ? "MoMo ops need a reason to act on it." : undefined}
      />
      <RequestError error={failure} />
    </Modal>
  );
}

// ─── D11 · Escalate · needs a reason ──────────────────────────────────────

export function EscalateModal({ detail, prefill, onClose }: { detail: CaseDetail; prefill?: string; onClose: () => void }) {
  const toast = useToast();
  const { data: people } = useColleagues();
  const { data: evidence } = useEvidence(detail.id);
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const supervisor = people?.data.find((p) => p.role === "fraud_supervisor");
  const [to, setTo] = useState<EscalationTarget>("supervisor");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal">("urgent");
  const [question, setQuestion] = useState(prefill ?? "");
  const [include, setInclude] = useState(true);
  const [tried, setTried] = useState(false);
  const first = firstName(supervisor?.name) || "your supervisor";
  const tooShort = question.trim().length < 20;
  const items = (evidence?.data.length ?? 0) + (detail.counts?.transactions ? 1 : 0);

  const send = async () => {
    setTried(true);
    if (tooShort) return;
    const ok = await run(async () => {
      await apiFetch("POST", `/cases/${detail.id}/escalations`, {
        target: to,
        to_user_id: to === "supervisor" ? supervisor?.id : undefined,
        question,
        kind: "question",
        priority,
        include_evidence: include,
      });
    });
    if (ok) {
      toast({
        tone: "success",
        title: `Escalated to ${to === "supervisor" ? (supervisor?.name ?? "your supervisor") : to === "legal" ? "Legal and compliance" : "MoMo operations"}`,
        body: "They’ve been notified in the app and by email.",
      });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={`Escalate ${detail.id}`}
      description="The case stays with you."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy}>
            Escalate
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>Escalate to</FieldLabel>
        </legend>
        <OptionCard
          name="to"
          checked={to === "supervisor"}
          onChange={() => setTo("supervisor")}
          title="Fraud supervisor"
          description={
            supervisor
              ? `${supervisor.name} · ${supervisor.on_shift ? "on shift" : "off shift"}${supervisor.typical_reply_minutes ? ` · usually replies in ${supervisor.typical_reply_minutes} min` : ""}`
              : "On shift now"
          }
          indent
        />
        <OptionCard name="to" checked={to === "legal"} onChange={() => setTo("legal")} title="Legal and compliance" description="Police referrals and regulator notices" indent />
        <OptionCard name="to" checked={to === "momo_ops"} onChange={() => setTo("momo_ops")} title="MoMo operations" description="Reversals and agent investigations" indent />
      </fieldset>
      <div className="flex flex-col gap-2">
        <FieldLabel>Priority</FieldLabel>
        <Chips
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={[
            ["urgent", "Urgent"],
            ["high", "High"],
            ["normal", "Normal"],
          ]}
        />
      </div>
      <TextArea
        label="Why are you escalating?"
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Agent AG-2231 may be involved; need approval to suspend the agent"
        error={tried && tooShort ? `Give ${first} enough to act without re-reading the case (20+ characters)` : undefined}
      />
      <CheckCard checked={include} onChange={(e) => setInclude(e.target.checked)} title="Include evidence and transactions" description={`${items} ${items === 1 ? "item" : "items"}`} />
      <RequestError error={failure} />
    </Modal>
  );
}

// ─── D14 · Request an agent suspension ────────────────────────────────────

const DURATION: Array<["1" | "7" | "30", string]> = [
  ["1", "24 hours"],
  ["7", "7 days"],
  ["30", "30 days"],
];

export function AgentSuspensionModal({ detail, agentCode, onClose }: { detail: CaseDetail; agentCode: string; onClose: () => void }) {
  const toast = useToast();
  const { data: agent } = useAgent(agentCode);
  const { data: people } = useColleagues();
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const supervisor = people?.data.find((p) => p.role === "fraud_supervisor");
  const [duration, setDuration] = useState<"1" | "7" | "30">("7");
  const [why, setWhy] = useState("");
  const [tried, setTried] = useState(false);
  const first = firstName(supervisor?.name) || "your supervisor";
  const span = DURATION.find(([d]) => d === duration)?.[1] ?? `${duration} days`;

  const send = async () => {
    setTried(true);
    if (!why.trim()) return;
    const ok = await run(async () => {
      // TODO(api): escalations have no agent or duration fields; both go in the question.
      await apiFetch("POST", `/cases/${detail.id}/escalations`, {
        target: "supervisor",
        to_user_id: supervisor?.id,
        kind: "agent_suspension",
        priority: "urgent",
        question: `Suspend agent ${agentCode} for ${span}: ${why}`,
        include_evidence: true,
      });
    });
    if (ok) {
      toast({ tone: "success", title: `Sent to ${first}`, body: `Suspension of ${agentCode} for ${span} is waiting for approval.` });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Suspend agent ${agentCode}`}
      description={`Your supervisor approves agent suspensions. ${first} is notified now.`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy}>
            Send to {first}
          </Button>
        </>
      }
    >
      <DetailRows
        rows={[
          ["Swaps today", agent ? `${agent.swaps_today ?? agent.sim_swaps_by_day.at(-1)?.count ?? 0}${agent.swaps_became_fraud ? ` · ${agent.swaps_became_fraud} became fraud` : ""}` : "…"],
          ["ID mismatches", agent?.id_mismatches ?? "…"],
          ["Customers served (30 days)", agent?.customers_30d ?? "…"],
        ]}
      />
      <div className="flex flex-col gap-2">
        <FieldLabel>Suggested duration</FieldLabel>
        <Chips label="Suggested duration" value={duration} onChange={setDuration} options={DURATION} />
      </div>
      <TextArea
        label="Why"
        rows={3}
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        placeholder="What makes this agent a risk?"
        error={tried && !why.trim() ? "Say why, so the approval is on record." : undefined}
      />
      <RequestError error={failure} />
    </Modal>
  );
}

// ─── D15 · Hand the case to a colleague ───────────────────────────────────

/** “SIM swap to MoMo, Agent cash-out”. */
const skillsOf = (p: Colleague) => p.skills.map(fraudTypeLabel).join(", ");

export function HandToColleagueModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { data } = useColleagues();
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const [query, setQuery] = useState("");
  const full = (p: Colleague) => (p.open_cases ?? 0) >= (p.case_limit ?? Infinity);
  const available = (p: Colleague) => p.on_shift && p.status !== "on_leave" && !full(p);
  const analysts = (data?.data ?? [])
    .filter((p) => p.open_cases !== undefined)
    .filter((p) => !query || `${p.name} ${skillsOf(p)}`.toLowerCase().includes(query.toLowerCase()))
    // Who has capacity now: available first, then fewest open cases.
    .sort((a, b) => Number(available(b)) - Number(available(a)) || (a.open_cases ?? 0) - (b.open_cases ?? 0));
  const [to, setTo] = useState<string | null>(null);
  const chosen = analysts.find((p) => p.id === (to ?? analysts.find(available)?.id));
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  const send = async () => {
    setTried(true);
    if (!note.trim() || !chosen) return;
    const ok = await run(async () => {
      await apiFetch("POST", `/cases/${detail.id}/handover`, { to_user_id: chosen.id, note });
    });
    if (ok) {
      toast({ tone: "success", title: `Offered to ${firstName(chosen.name)}`, body: "The case stays with you until they accept." });
      onClose();
    }
  };

  const status = (p: Colleague) =>
    p.status === "on_leave" ? "on leave" : !p.on_shift ? "off shift" : full(p) ? "at their limit" : `on shift${p.shift ? ` until ${p.shift.split("-")[1]}` : ""}`;

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={`Hand ${detail.id} to a colleague`}
      description="Sorted by who has capacity now"
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy} disabled={!chosen}>
            Hand to {firstName(chosen?.name) || "…"}
          </Button>
        </>
      }
    >
      <TextField
        size="md"
        type="search"
        aria-label="Search analysts"
        placeholder="Search analysts"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        iconLeft={<Icon name="app/icon-search-tertiary-16" size={16} />}
      />
      <div role="radiogroup" aria-label="Colleague" className="flex flex-col gap-2">
        {analysts.map((p) => {
          const ok = available(p);
          const on = chosen?.id === p.id;
          return (
            <label
              key={p.id}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border px-4 py-3.5",
                on ? "border-[1.5px] border-brand-primary bg-brand-primary-subtle" : "border-border-default bg-surface-base",
                ok ? "cursor-pointer" : "cursor-not-allowed bg-surface-raised opacity-60",
              )}
            >
              <input
                type="radio"
                name="colleague"
                checked={on}
                disabled={!ok}
                onChange={() => setTo(p.id)}
                className="mt-px size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.25px] border-border-strong bg-surface-base checked:border-[5px] checked:border-brand-primary disabled:cursor-not-allowed"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body-m text-text-primary">{p.name}</span>
                <span className="truncate text-body-s text-text-secondary">{[roleLabel(p.role), skillsOf(p), status(p)].filter(Boolean).join(" · ")}</span>
              </span>
              <Badge label={p.on_shift ? `${p.open_cases} open` : p.status === "on_leave" ? "On leave" : "Off shift"} tone="brand" />
            </label>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <TextArea
          label="Handover note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Where things stand and what’s next"
          error={tried && !note.trim() ? "Tell them where things stand." : undefined}
        />
        <p className="flex items-center gap-1.5 text-caption text-text-secondary">
          <Icon name="app/icon-info-secondary-16" size={14} />
          They’ll see this at the top of the case
        </p>
      </div>
      <RequestError error={failure} />
    </Modal>
  );
}
