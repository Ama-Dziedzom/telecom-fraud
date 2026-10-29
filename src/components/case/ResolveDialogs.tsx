"use client";

import { Banner } from "@/components/ui/Banner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCard, OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, Select, TextArea, TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { RequestError } from "@/components/auth/RequestError";
import { apiFetch } from "@/lib/api/client";
import { useColleagues, useEvidence, useReversal, type CaseChange, type CaseDetail, type Monitoring, type Outcome } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, useNow } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Chips, firstName, localMsisdn, whenAt } from "./parts";

const OUTCOMES: Array<{ id: Outcome; title: string; detail: string; signoff?: boolean }> = [
  { id: "confirmed_fraud", title: "Confirmed fraud", detail: "Needs supervisor sign-off", signoff: true },
  { id: "false_positive", title: "False positive", detail: "Closes now. Your feedback tunes the rules" },
  { id: "inconclusive", title: "Inconclusive", detail: "Closes now. The number is watched for 30 days" },
];

const LEGIT_REASONS = [
  ["device_change_verified", "Customer changed phone: verified in branch"],
  ["known_behaviour", "Known customer behaviour (salary, fees, business)"],
  ["family_transfers", "Transfers to family the subscriber confirmed"],
  ["test_traffic", "Test or system traffic"],
] as const;

const MIN_SUMMARY = 40;

/** “18,400.00” ⇄ minor units. */
const toInput = (minor?: number) => (minor === undefined ? "" : (minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }));
const fromInput = (v: string) => Math.round(Number(v.replace(/[^\d.]/g, "") || 0) * 100);

/** E1/E2/E8/E10 · Resolve — confirmed fraud (sign-off), false positive, or inconclusive. */
export function ResolveModal({ detail, initial, onClose }: { detail: CaseDetail; initial?: Outcome; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: reversal } = useReversal(detail.reversal?.id);
  const { data: people } = useColleagues();
  const supervisor = people?.data.find((p) => p.role === "fraud_supervisor");
  const recovered = reversal?.results?.reduce((s, r) => s + r.recovered.amount_minor, 0) || detail.reversal?.secured.amount_minor;
  const lostDefault = detail.what_happened.find((s) => s.amount)?.amount?.amount_minor ?? detail.glance.money.amount.amount_minor;
  const agent = detail.what_happened.find((s) => s.kind === "sim_swap")?.detail?.match(/AG-\d+/)?.[0];
  const ring = detail.linked_cases[0];

  const [outcome, setOutcome] = useState<Outcome | null>(initial ?? null);
  const [lost, setLost] = useState(toInput(lostDefault));
  const [back, setBack] = useState(toInput(recovered));
  const [summary, setSummary] = useState("");
  const [reportAgent, setReportAgent] = useState(Boolean(agent));
  const [linkRing, setLinkRing] = useState(Boolean(ring));
  const [legitReason, setLegitReason] = useState<string>(LEGIT_REASONS[0][0]);
  const [ruleNote, setRuleNote] = useState("");
  const [watchDays, setWatchDays] = useState<"14" | "30" | "90">("30");
  const [reopenOnRepeat, setReopenOnRepeat] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const summaryShort = summary.trim().length < MIN_SUMMARY;
  const problems = [!outcome && "outcome", summaryShort && "summary"].filter(Boolean);
  const label =
    outcome === "confirmed_fraud" ? "Submit for sign-off" : outcome === "false_positive" ? "Close as false positive" : outcome === "inconclusive" ? "Close as inconclusive" : "Resolve case";

  const submit = async () => {
    setTried(true);
    if (problems.length) return;
    setBusy(true);
    setFailure(null);
    try {
      const change = await apiFetch<CaseChange>("POST", `/cases/${detail.id}/resolution`, {
        outcome,
        summary,
        ...(outcome === "confirmed_fraud"
          ? {
              amount_lost: { amount_minor: fromInput(lost), currency: "GHS" },
              amount_recovered: { amount_minor: fromInput(back), currency: "GHS" },
              recovered_via: detail.reversal?.id,
              report_agent: reportAgent,
              link_cases: linkRing && ring ? [ring] : [],
            }
          : {}),
        ...(outcome === "false_positive" ? { reason: legitReason, rule_feedback: true, rule_feedback_note: ruleNote || undefined } : {}),
        ...(outcome === "inconclusive" ? { watch_days: Number(watchDays), reopen_on_repeat: reopenOnRepeat } : {}),
      });
      await mutate<CaseDetail>(`/cases/${detail.id}`, (c) => (c ? { ...c, ...change } : c), { revalidate: false });
      await Promise.all([mutate(`/cases/${detail.id}/timeline`), mutate("/cases?view=mine")]);
      if (outcome === "confirmed_fraud") {
        toast({ tone: "success", title: "Submitted for sign-off", body: `${firstName(supervisor?.name) || "Your supervisor"} will review ${detail.id}. We’ll let you know.` });
      } else {
        toast({
          tone: "success",
          title: `${detail.id} closed as ${outcome === "false_positive" ? "false positive" : "inconclusive"}`,
          body: outcome === "false_positive" ? "Rule feedback sent to the rules team." : `Watching the number for ${watchDays} days.`,
          action: { label: "Next case", onClick: () => router.push("/queue") },
        });
      }
      onClose();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={`Resolve ${detail.id}`}
      description={outcome === "false_positive" ? `${detail.title} · ${localMsisdn(detail.subject.msisdn)}` : "Goes on the case record and any regulator report."}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={busy}>
            {label}
          </Button>
        </>
      }
    >
      {tried && problems.length > 0 && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-critical-border bg-critical-bg px-3.5 py-3 text-body-s text-critical-fg">
          <Icon name="app/icon-alert-circle-critical-16" size={16} />
          {problems.length === 1 ? "1 thing needs fixing" : `${problems.length} things need fixing`} before you can resolve
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>Outcome</FieldLabel>
        </legend>
        {OUTCOMES.map((o) => (
          <OptionCard
            key={o.id}
            name="outcome"
            checked={outcome === o.id}
            onChange={() => setOutcome(o.id)}
            title={o.title}
            badge={o.signoff ? <span className="ml-auto"><Badge label="Sign-off" tone="brand" /></span> : undefined}
            description={o.id === "inconclusive" && outcome === o.id ? `Closes now. The number is watched for ${watchDays} days` : o.detail}
            invalid={tried && !outcome}
            indent
          />
        ))}
        {tried && !outcome && <p className="text-caption text-critical-fg">Choose an outcome</p>}
      </fieldset>

      {outcome === "confirmed_fraud" && (
        <div className="flex gap-3">
          <TextField size="md" label="Amount lost (GHS)" inputMode="decimal" value={lost} onChange={(e) => setLost(e.target.value)} />
          <TextField
            size="md"
            label="Recovered (GHS)"
            inputMode="decimal"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            hint={detail.reversal ? `From reversal ${detail.reversal.id}` : undefined}
          />
        </div>
      )}
      {outcome === "false_positive" && (
        <>
          <Select label="Why was it legitimate?" value={legitReason} onChange={(e) => setLegitReason(e.target.value)}>
            {LEGIT_REASONS.map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <TextArea label="What should the rule have known?" optional rows={3} value={ruleNote} onChange={(e) => setRuleNote(e.target.value)} />
            <p className="flex items-center gap-1.5 text-caption text-text-secondary">
              <Icon name="app/icon-info-secondary-16" size={14} />
              Goes to the rules team with this case attached
            </p>
          </div>
        </>
      )}
      {outcome === "inconclusive" && (
        <div className="flex flex-col gap-2">
          <FieldLabel>Watch for</FieldLabel>
          <Chips
            label="Watch for"
            value={watchDays}
            onChange={setWatchDays}
            options={[
              ["14", "14 days"],
              ["30", "30 days"],
              ["90", "90 days"],
            ]}
          />
        </div>
      )}

      <TextArea
        label={outcome === "inconclusive" ? "What you couldn’t confirm" : "Resolution summary"}
        rows={3}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What happened, and what you did about it"
        error={tried && summaryShort ? `Too short: say what happened and what you did (${MIN_SUMMARY}+ characters)` : undefined}
      />

      {outcome === "confirmed_fraud" && (agent || ring) && (
        <div className="flex flex-col gap-2">
          {agent && <CheckCard title={`Report agent ${agent} to MoMo operations`} checked={reportAgent} onChange={(e) => setReportAgent(e.target.checked)} />}
          {ring && <CheckCard title={`Link ring ${ring} to this case`} checked={linkRing} onChange={(e) => setLinkRing(e.target.checked)} />}
        </div>
      )}
      {outcome === "inconclusive" && (
        <CheckCard title="Reopen automatically if a new alert fires on this number" checked={reopenOnRepeat} onChange={(e) => setReopenOnRepeat(e.target.checked)} />
      )}
      <RequestError error={failure} />
    </Modal>
  );
}

/** E5 · Resubmit after a send-back — shows what changed since it was sent back. */
export function ResubmitModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data: evidence } = useEvidence(detail.id);
  // The send-back is a banner on the case; the submission is a step in “What happened”.
  const sentBack = detail.banners.find((b) => b.kind === "sent_back");
  const submittedAt = detail.what_happened.findLast((s) => s.kind === "submitted")?.at ?? sentBack?.at ?? detail.opened.at;
  const since = sentBack?.at ?? submittedAt;
  const added = (evidence?.data ?? []).filter((e) => Date.parse(e.attached_at) > Date.parse(since));
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const first = firstName(sentBack?.by?.name) || "your supervisor";

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const change = await apiFetch<CaseChange>("POST", `/cases/${detail.id}/resubmit`, { reply: reply || undefined });
      // Keep the new status: the mock would answer with the sent-back case again.
      await mutate<CaseDetail>(`/cases/${detail.id}`, (c) => (c ? { ...c, ...change } : c), { revalidate: false });
      await mutate(`/cases/${detail.id}/timeline`);
      toast({ tone: "success", title: "Resubmitted for sign-off", body: `${first} has been notified.` });
      onClose();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Resubmit ${detail.id} for sign-off`}
      description={`${first[0].toUpperCase()}${first.slice(1)} sent this back at ${formatClock(since)}. Here’s what changed.`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={busy}>
            Resubmit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-raised p-4">
        <p className="text-caption text-text-secondary">Changed since {formatClock(since)}</p>
        {added.length ? (
          added.map((e) => (
            <p key={e.id} className="flex items-center gap-2 text-body-s text-text-primary">
              <Icon name="app/icon-file-secondary-16" size={16} />
              Evidence: {e.title} added
            </p>
          ))
        ) : (
          <p className="text-body-s text-text-secondary">Nothing new yet. Add what was asked for first, or reply to explain.</p>
        )}
      </div>
      <TextArea label={`Reply to ${first}`} optional rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
      <RequestError error={failure} />
    </Modal>
  );
}

const REOPEN_REASONS = [
  ["linked_activity", "New activity on a linked wallet"],
  ["new_alert", "A new alert on this number"],
  ["new_evidence", "New evidence came in"],
  ["outcome_wrong", "The outcome was wrong"],
] as const;

/** E11 · Reopen a closed case. */
export function ReopenModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const r = detail.resolution;
  const now = useNow();
  const [reason, setReason] = useState<string>(REOPEN_REASONS[0][0]);
  const [details, setDetails] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const outcome = r ? OUTCOMES.find((o) => o.id === r.outcome)?.title.toLowerCase() : "closed";

  const submit = async () => {
    setTried(true);
    if (!details.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const change = await apiFetch<CaseChange>("POST", `/cases/${detail.id}/reopen`, { reason: `${REOPEN_REASONS.find(([id]) => id === reason)?.[1]}: ${details}` });
      await mutate<CaseDetail>(`/cases/${detail.id}`, (c) => (c ? { ...c, ...change } : c), { revalidate: false });
      await mutate(`/cases/${detail.id}/timeline`);
      toast({ tone: "success", title: `${detail.id} reopened`, body: "It’s back in Investigate, assigned to you." });
      onClose();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reopen ${detail.id}?`}
      description={r ? `Closed ${whenAt(r.closed_at, now)} as ${outcome}${r.signed_off_by ? ` · signed off by ${r.signed_off_by.name}` : ""}` : "This case is closed."}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={busy}>
            Reopen case
          </Button>
        </>
      }
    >
      <Select label="Why reopen?" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REOPEN_REASONS.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </Select>
      <TextArea label="Details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} error={tried && !details.trim() ? "Say what changed." : undefined} />
      <Banner tone="info" title="Reopening returns it to Investigate, assigned to you">
        The original resolution{r?.signed_off_by ? ` and ${firstName(r.signed_off_by.name)}’s sign-off` : ""} stay on the record.
      </Banner>
      <RequestError error={failure} />
    </Modal>
  );
}

/** “35209900176148 7” → “35 209900 176148 7”, how an IMEI is read out. */
const imei = (digits: string) => digits.replace(/\D/g, "").replace(/^(\d{2})(\d{6})(\d{6})(\d)$/, "$1 $2 $3 $4");

/** F1 · Close and monitor — what to watch, for how long, and what happens on a repeat. */
export function MonitorModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const first = firstName(detail.subject.name);
  const agent = detail.what_happened.find((s) => s.kind === "sim_swap")?.detail?.match(/AG-\d+/)?.[0];
  const recipients = detail.what_happened.find((s) => s.kind === "wallets_paid")?.label.match(/(\d+) wallets?/)?.[1];
  const things = [
    { id: detail.subject.subscriber_id, title: `${first}’s wallet and SIM`, detail: "Any new swap, new phone or big transfer", on: true },
    ...(agent ? [{ id: agent, title: `Agent ${agent}`, detail: "SIM swaps over 5 a day", on: true }] : []),
    // Not an entity: sent as `include_recipients`.
    { id: "recipients", title: `${recipients ?? "The"} recipient wallets`, detail: "Any money in from another victim", on: true },
    // TODO(api): the case has no device entity; the IMEI is the one on the timeline.
    { id: "dev_4417", title: `Phone IMEI ${imei("352099001761487")}`, detail: "If it shows up with another SIM", on: false },
  ];
  const [days, setDays] = useState<"30" | "60" | "90">("90");
  const [picked, setPicked] = useState(() => new Set(things.filter((t) => t.on).map((t) => t.id)));
  const [then, setThen] = useState<"reopen" | "notify">("reopen");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const watch = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const watching = await apiFetch<Monitoring>("POST", `/cases/${detail.id}/monitor`, {
        days: Number(days),
        entity_ids: Array.from(picked).filter((id) => id !== "recipients"),
        include_recipients: picked.has("recipients"),
        reopen_on_repeat: then === "reopen",
      });
      await mutate<CaseDetail>(`/cases/${detail.id}`, (c) => (c ? { ...c, stage: "monitor", monitoring: watching } : c), { revalidate: false });
      await mutate("/watchlist");
      toast({ tone: "success", title: `Watching for ${days} days`, body: `${watching.entities.length} things on watch. ${then === "reopen" ? "A repeat reopens the case." : "We’ll tell you if anything happens."}` });
      onClose();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={`Keep watching ${detail.id}`}
      description="We’ll watch these and reopen the case if fraud repeats."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Not now
          </Button>
          <Button size="md" onClick={watch} loading={busy} disabled={!picked.size}>
            Watch for {days} days
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <FieldLabel>For</FieldLabel>
        <Chips
          label="For"
          value={days}
          onChange={setDays}
          options={[
            ["30", "30 days"],
            ["60", "60 days"],
            ["90", "90 days"],
          ]}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>Watch</FieldLabel>
        </legend>
        {things.map((t) => (
          <CheckCard
            key={t.id}
            checked={picked.has(t.id)}
            onChange={(e) =>
              setPicked((p) => {
                const next = new Set(p);
                if (e.target.checked) next.add(t.id);
                else next.delete(t.id);
                return next;
              })
            }
            title={t.title}
            description={t.detail}
          />
        ))}
      </fieldset>
      <fieldset className={cn("flex flex-col gap-2")}>
        <legend className="mb-2">
          <FieldLabel>If something happens</FieldLabel>
        </legend>
        <OptionCard name="then" checked={then === "reopen"} onChange={() => setThen("reopen")} title="Reopen this case and tell me" description="Best for confirmed fraud" indent />
        <OptionCard name="then" checked={then === "notify"} onChange={() => setThen("notify")} title="Just tell me" description="You decide what to do" indent />
      </fieldset>
      <RequestError error={failure} />
    </Modal>
  );
}
