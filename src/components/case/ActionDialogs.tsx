"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCard, Checkbox, OptionCard } from "@/components/ui/Choice";
import { KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { FieldLabel, Select, TextArea, TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useAgent, useCaseTransactions, useColleagues, useEvidence, type CaseDetail, type Transaction } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, now as appNow } from "@/lib/time";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";

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

function Chips<T extends string>({ value, onChange, options, tone }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; tone?: (v: T) => "critical" | "brand" }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map(([id, label]) => {
        const on = id === value;
        const t = tone?.(id) ?? "brand";
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-label-m",
              on && t === "brand" && "border-brand-primary bg-brand-primary text-text-inverse",
              on && t === "critical" && "border-critical-fg bg-critical-bg text-critical-fg",
              !on && "border-border-default bg-surface-base text-text-primary hover:bg-surface-raised",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── D7 · Log a call with the subscriber ──────────────────────────────────

const OUTCOMES: Array<["reached" | "no_answer" | "wrong_person" | "call_back", string]> = [
  ["reached", "Reached"],
  ["no_answer", "No answer"],
  ["wrong_person", "Wrong person"],
  ["call_back", "Call back later"],
];

export function CallLogModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const contact = detail.contact ?? { alt_msisdn: "Alternate number", registered: detail.subject.msisdn, language: "English" };
  const [number, setNumber] = useState<"alternate" | "registered">("alternate");
  const [language, setLanguage] = useState(contact.language);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number][0]>("reached");
  const first = detail.subject.name.split(" ")[0];
  const questions = ["Did they request the SIM swap?", `Do they recognise the ${detail.what_happened.find((s) => s.kind === "payments_out")?.label.match(/\d+/)?.[0] ?? ""} transfers?`.replace("  ", " "), "Did anyone ask for their PIN or ID recently?"];
  const [answers, setAnswers] = useState<Array<{ checked: boolean; answer: string }>>(questions.map(() => ({ checked: false, answer: "" })));
  const [summary, setSummary] = useState("");
  const [tried, setTried] = useState(false);

  const save = async () => {
    setTried(true);
    if (!summary.trim()) return;
    const ok = await run(async () => {
      await apiFetch("POST", `/cases/${detail.id}/calls`, {
        number_ref: number === "alternate" ? "alt" : "registered",
        outcome,
        notes: summary,
        language,
        answers: questions.map((q, i) => ({ question: q, ...answers[i] })).filter((a) => a.checked),
      });
    });
    if (ok) {
      toast({ tone: "success", title: "Call logged", body: outcome === "reached" ? `It’s on the timeline. Next: request a reversal.` : "It’s on the timeline." });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      icon="app/icon-phone-brand-22"
      tone="brand"
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
      <div className="flex gap-4">
        <Select label="Number called" value={number} onChange={(e) => setNumber(e.target.value as typeof number)} iconLeft={<Icon name="app/icon-phone-16" size={16} />}>
          <option value="alternate">{contact.alt_msisdn} · alternate</option>
          <option value="registered">{contact.registered} · registered (compromised)</option>
        </Select>
        <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {["Twi", "English", "Ga", "Ewe", "Fante", "Hausa"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>Outcome</FieldLabel>
        <Chips value={outcome} onChange={setOutcome} options={OUTCOMES} />
      </div>
      {outcome === "reached" && (
        <div className="flex flex-col gap-2">
          <FieldLabel>Key answers</FieldLabel>
          {questions.map((q, i) => (
            <div key={q} className={cn("flex flex-col gap-1.5 rounded-[10px]", answers[i].checked && "")}>
              <CheckCard
                checked={answers[i].checked}
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                title={q}
                description={
                  answers[i].checked ? (
                    <input
                      aria-label={`Answer: ${q}`}
                      placeholder="Their answer"
                      value={answers[i].answer}
                      onClick={(e) => e.preventDefault()}
                      onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                      className="w-full bg-transparent text-body-s text-text-secondary outline-none focus-visible:shadow-none"
                    />
                  ) : (
                    "Tick when asked"
                  )
                }
              />
            </div>
          ))}
        </div>
      )}
      <TextArea
        label="Summary"
        required
        rows={2}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder={`What did ${first} say?`}
        error={tried && !summary.trim() ? "Add a short summary: it goes on the case record." : undefined}
      />
      <RequestError error={failure} />
    </Modal>
  );
}

// ─── D8 · Request reversal from MoMo ops ──────────────────────────────────

const WHERE: Record<string, { label: (t: Transaction) => string; tone: "medium" | "critical" | "success"; recoverable: boolean }> = {
  agent_holds: { label: () => "Cash-out · agent holds it", tone: "medium", recoverable: true },
  cashed_out: { label: (t) => `Cashed out ${formatClock(Date.parse(t.at) + 12 * 60_000)}`, tone: "critical", recoverable: false },
  in_wallet: { label: () => "Still in wallet", tone: "success", recoverable: true },
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
      width={640}
      icon="app/icon-refresh-brand-22"
      tone="brand"
      title="Request reversal"
      description="Goes to MoMo operations · they reply within 2 hours on working days"
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy} disabled={!requested.length} iconLeft={<Icon name="app/icon-send-white-18" size={18} />}>
            Send request · {formatMoney(sum(requested), "GHS")}
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <table className="w-full text-left">
          <thead className="border-b border-border-subtle bg-surface-raised">
            <tr className="text-overline text-text-tertiary uppercase">
              <th className="w-11 py-2.5 pl-4">
                <Checkbox
                  label="Select all"
                  hideLabel
                  checked={all}
                  indeterminate={requested.length > 0 && !all}
                  onChange={(e) => setPicked(new Set(e.target.checked ? rows.map((t) => t.id) : []))}
                />
              </th>
              <th className="py-2.5 font-bold">Time</th>
              <th className="py-2.5 font-bold">To</th>
              <th className="py-2.5 font-bold">Where the money is</th>
              <th className="py-2.5 pr-4 text-right font-bold">GHS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const where = WHERE[t.where_now ?? "in_wallet"] ?? WHERE.in_wallet;
              return (
                <tr key={t.id} className={cn("border-b border-border-subtle last:border-b-0", chosen.has(t.id) && "bg-brand-primary-subtle/50")}>
                  <td className="py-2.5 pl-4">
                    <Checkbox label={`Select ${t.id}`} hideLabel checked={chosen.has(t.id)} onChange={(e) => toggle(t.id, e.target.checked)} />
                  </td>
                  <td className="py-2.5 font-mono text-mono-s text-text-primary">{formatClock(t.at)}</td>
                  <td className="py-2.5 font-mono text-mono-m text-text-primary">{t.counterparty}</td>
                  <td className="py-2.5">
                    <Badge label={where.label(t)} tone={where.tone} />
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-mono-m text-text-primary">
                    -{(t.amount.amount_minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex rounded-xl bg-surface-sunken px-4 py-3">
        {[
          ["Requested", formatMoney(sum(requested), "GHS"), "text-text-primary"],
          ["Likely recoverable", `≈ ${formatMoney(sum(likely), "GHS")}`, "text-success-fg"],
          ["Already cashed out", formatMoney(sum(gone), "GHS"), "text-critical-fg"],
        ].map(([k, v, tone]) => (
          <div key={k} className="flex flex-1 flex-col gap-0.5">
            <span className="text-caption text-text-secondary">{k}</span>
            <span className={cn("text-h3", tone)}>{v}</span>
          </div>
        ))}
      </div>
      <TextArea
        label="Note for MoMo ops"
        required
        rows={2}
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
  const supervisor = people?.data.find((p) => p.role === "Fraud Supervisor");
  const [to, setTo] = useState<"supervisor" | "legal" | "momo_ops">("supervisor");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal">("urgent");
  const [question, setQuestion] = useState(prefill ?? "");
  const [include, setInclude] = useState(true);
  const [tried, setTried] = useState(false);
  const first = supervisor?.name.split(" ")[0] ?? "your supervisor";
  const tooShort = question.trim().length < 20;
  const items = (evidence?.data.length ?? 0) + (detail.counts?.transactions ? 1 : 0);

  const send = async () => {
    setTried(true);
    if (tooShort) return;
    const ok = await run(async () => {
      await apiFetch("POST", `/cases/${detail.id}/escalations`, {
        to_user_id: to === "supervisor" ? supervisor?.id : undefined,
        team: to,
        question,
        kind: "question",
        priority,
        include_evidence: include,
      });
    });
    if (ok) {
      toast({
        tone: "success",
        title: `Escalated to ${to === "supervisor" ? supervisor?.name ?? "your supervisor" : to === "legal" ? "Legal & compliance" : "MoMo operations"}`,
        body: "They’ve been notified in-app and by email.",
      });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={600}
      icon="app/icon-escalate-brand-22"
      tone="brand"
      title={`Escalate ${detail.id}`}
      description="The case stays with you."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy} iconLeft={<Icon name="app/icon-escalate-white-18" size={18} />}>
            Escalate
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel required>Escalate to</FieldLabel>
        </legend>
        <OptionCard
          name="to"
          checked={to === "supervisor"}
          onChange={() => setTo("supervisor")}
          title="Fraud supervisor"
          description={supervisor ? `${supervisor.name} · ${supervisor.on_shift ? "on shift" : "off shift"}${supervisor.reply_minutes ? ` · usually replies in ~${supervisor.reply_minutes} min` : ""}` : "On shift now"}
          indent
        />
        <OptionCard name="to" checked={to === "legal"} onChange={() => setTo("legal")} title="Legal & compliance" description="For police referrals or regulator notices" indent />
        <OptionCard name="to" checked={to === "momo_ops"} onChange={() => setTo("momo_ops")} title="MoMo operations" description="For reversals and agent investigations" indent />
      </fieldset>
      <div className="flex flex-col gap-2">
        <FieldLabel required>Priority</FieldLabel>
        <Chips
          value={priority}
          onChange={setPriority}
          options={[
            ["urgent", "Urgent"],
            ["high", "High"],
            ["normal", "Normal"],
          ]}
          tone={(v) => (v === "urgent" ? "critical" : "brand")}
        />
      </div>
      <TextArea
        label="Why are you escalating?"
        required
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Agent AG-2231 may be involved, need approval to suspend the agent."
        error={tried && tooShort ? `Give ${first} enough to act without re-reading the case (20+ characters).` : undefined}
      />
      <Checkbox label={`Include evidence and transactions (${items} items)`} checked={include} onChange={(e) => setInclude(e.target.checked)} />
      <RequestError error={failure} />
    </Modal>
  );
}

// ─── D14 · Request an agent suspension ────────────────────────────────────

export function AgentSuspensionModal({ detail, agentCode, onClose }: { detail: CaseDetail; agentCode: string; onClose: () => void }) {
  const toast = useToast();
  const { data: agent } = useAgent(agentCode);
  const { data: people } = useColleagues();
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const supervisor = people?.data.find((p) => p.role === "Fraud Supervisor");
  const [duration, setDuration] = useState<"1" | "7" | "30">("7");
  const [why, setWhy] = useState("");
  const [tried, setTried] = useState(false);
  const first = supervisor?.name.split(" ")[0] ?? "your supervisor";

  const send = async () => {
    setTried(true);
    if (!why.trim()) return;
    const ok = await run(async () => {
      await apiFetch("POST", `/cases/${detail.id}/escalations`, {
        to_user_id: supervisor?.id,
        kind: "agent_suspension",
        question: why,
        agent_code: agentCode,
        days: Number(duration),
      });
    });
    if (ok) {
      toast({ tone: "success", title: `Sent to ${first}`, body: `Suspension of ${agentCode} for ${duration === "1" ? "24 hours" : `${duration} days`} is waiting for approval.` });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={540}
      icon="app/icon-shield-brand-22"
      tone="brand"
      title={`Request suspension of agent ${agentCode}`}
      description={`Your supervisor approves agent suspensions. ${first} is notified now.`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy} iconLeft={<Icon name="app/icon-send-white-18" size={18} />}>
            Send to {first}
          </Button>
        </>
      }
    >
      <KeyValueList
        rows={[
          ["Swaps today", agent ? `${agent.swaps_today ?? agent.sim_swaps_by_day.at(-1)?.count ?? 0}${agent.swaps_became_fraud ? ` · ${agent.swaps_became_fraud} became fraud` : ""}` : "…"],
          ["ID mismatches", agent?.id_mismatches ?? "…"],
          ["Customers served (30d)", agent?.customers_30d ?? "…"],
        ]}
      />
      <div className="flex flex-col gap-2">
        <FieldLabel>Suggested duration</FieldLabel>
        <div className="w-fit">
          <Segmented
            label="Suggested duration"
            value={duration}
            onChange={setDuration}
            options={[
              { id: "1", label: "24 hours" },
              { id: "7", label: "7 days" },
              { id: "30", label: "30 days" },
            ]}
          />
        </div>
      </div>
      <TextArea
        label="Why"
        required
        rows={2}
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

export function HandToColleagueModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { data } = useColleagues();
  const { busy, failure, run } = useCaseSubmit(detail.id);
  const [query, setQuery] = useState("");
  const analysts = (data?.data ?? [])
    .filter((p) => p.open_cases !== undefined)
    .filter((p) => !query || `${p.name} ${p.skills}`.toLowerCase().includes(query.toLowerCase()))
    // Who has capacity now: on shift first, then fewest open cases.
    .sort((a, b) => Number(b.on_shift) - Number(a.on_shift) || (a.open_cases ?? 0) - (b.open_cases ?? 0));
  const [to, setTo] = useState<string | null>(null);
  const chosen = analysts.find((p) => p.id === (to ?? analysts[0]?.id));
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  const send = async () => {
    setTried(true);
    if (!note.trim() || !chosen) return;
    const ok = await run(async () => {
      await apiFetch("POST", `/cases/${detail.id}/handover`, { to_user_id: chosen.id, note });
    });
    if (ok) {
      toast({ tone: "success", title: `Offered to ${chosen.name.split(" ")[0]}`, body: "The case stays with you until they accept." });
      onClose();
    }
  };

  const capacity = (p: (typeof analysts)[number]): ReactNode => {
    if (!p.on_shift) return <Badge label="Off shift" tone="neutral" />;
    const full = (p.open_cases ?? 0) >= (p.limit ?? Infinity);
    return <span className={cn("text-caption", full ? "text-critical-fg" : "text-text-secondary")}>{p.open_cases} open{full ? " (at limit)" : ""}</span>;
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      icon="app/icon-users-brand-22"
      tone="brand"
      title={`Hand ${detail.id} to a colleague`}
      description="Sorted by who has capacity now"
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy} disabled={!chosen} iconLeft={<Icon name="app/icon-users-white-18" size={18} />}>
            Hand to {chosen?.name.split(" ")[0] ?? "…"}
          </Button>
        </>
      }
    >
      <TextField
        size="md"
        type="search"
        aria-label="Search analysts"
        placeholder="Search analysts…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        iconLeft={<Icon name="app/icon-search-18" size={18} />}
      />
      <div role="radiogroup" className="flex flex-col gap-2">
        {analysts.map((p) => {
          const full = (p.open_cases ?? 0) >= (p.limit ?? Infinity);
          const on = chosen?.id === p.id;
          return (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3",
                on ? "border-[1.5px] border-brand-primary bg-brand-primary-subtle" : "border-border-default",
                (!p.on_shift || full) && !on && "opacity-70",
              )}
            >
              <input
                type="radio"
                name="colleague"
                checked={on}
                disabled={!p.on_shift || full}
                onChange={() => setTo(p.id)}
                className="size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.25px] border-border-strong bg-surface-base checked:border-[5px] checked:border-brand-primary disabled:cursor-not-allowed"
              />
              <Avatar initials={p.initials} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-label-m", p.on_shift ? "text-text-primary" : "text-text-secondary")}>{p.name}</span>
                <span className="truncate text-caption text-text-secondary">{[p.role, p.skills, p.note].filter(Boolean).join(" · ")}</span>
              </span>
              {capacity(p)}
            </label>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <TextArea
          label="Handover note"
          required
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Where things stand and what’s next"
          error={tried && !note.trim() ? "Tell them where things stand." : undefined}
        />
        <p className="text-caption text-text-secondary">They’ll see this at the top of the case.</p>
      </div>
      <RequestError error={failure} />
    </Modal>
  );
}
