"use client";

import { Banner } from "@/components/ui/Banner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { FieldLabel, Select, TextArea, TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { RequestError } from "@/components/auth/RequestError";
import { apiFetch } from "@/lib/api/client";
import { useColleagues, useEvidence, useReversal, type CaseChange, type CaseDetail, type Monitoring, type Outcome } from "@/lib/api/cases";
import { formatClock, formatDate } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

const OUTCOMES: Array<{ id: Outcome; title: string; detail: string; signoff?: boolean }> = [
  { id: "confirmed_fraud", title: "Confirmed fraud", detail: "Needs supervisor sign-off.", signoff: true },
  { id: "false_positive", title: "False positive", detail: "Closes now · feedback tunes the rules." },
  { id: "inconclusive", title: "Inconclusive", detail: "Closes now · number watched for 30 days." },
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
export function ResolveModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
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

  const [outcome, setOutcome] = useState<Outcome | null>(null);
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
        toast({ tone: "success", title: "Submitted for sign-off", body: `${supervisor?.name.split(" ")[0] ?? "Your supervisor"} will review ${detail.id}. We’ll let you know.` });
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
      width={620}
      icon="app/icon-check-brand-22"
      tone="brand"
      title={`Resolve ${detail.id}`}
      description={outcome === "false_positive" ? `${detail.title} · ${detail.subject.msisdn}` : "Goes on the case record and any regulator report."}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={busy} iconLeft={outcome === "confirmed_fraud" ? <Icon name="app/icon-send-white-18" size={18} /> : undefined}>
            {label}
          </Button>
        </>
      }
    >
      {tried && problems.length > 0 && (
        <p role="alert" className="flex items-center gap-2.5 rounded-[10px] border border-critical-border bg-critical-bg px-3.5 py-3 text-label-m text-critical-fg">
          <Icon name="icon-alert-circle-critical-20" size={20} />
          {problems.length === 1 ? "1 thing needs fixing" : `${problems.length} things need fixing`} before you can resolve
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel required>Outcome</FieldLabel>
        </legend>
        {OUTCOMES.map((o) => (
          <OptionCard
            key={o.id}
            name="outcome"
            checked={outcome === o.id}
            onChange={() => setOutcome(o.id)}
            title={o.title}
            badge={o.signoff ? <Badge label="Sign-off" tone="medium" /> : undefined}
            description={o.detail}
            invalid={tried && !outcome}
            indent
          />
        ))}
        {tried && !outcome && (
          <p className="flex items-center gap-1.5 text-caption text-critical-fg">
            <Icon name="icon-alert-critical" size={14} />
            Choose an outcome.
          </p>
        )}
      </fieldset>

      {outcome === "confirmed_fraud" && (
        <div className="flex gap-4">
          <TextField size="lg" mono label="Amount lost (GHS)" inputMode="decimal" value={lost} onChange={(e) => setLost(e.target.value)} />
          <TextField
            size="lg"
            mono
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
          <Select label="Why was it legitimate?" required value={legitReason} onChange={(e) => setLegitReason(e.target.value)}>
            {LEGIT_REASONS.map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <TextArea label="What should the rule have known?" optional rows={2} value={ruleNote} onChange={(e) => setRuleNote(e.target.value)} />
            <p className="text-caption text-text-secondary">Goes to the rules team with this case attached.</p>
          </div>
        </>
      )}
      {outcome === "inconclusive" && (
        <div className="flex flex-col gap-2">
          <FieldLabel>Watch for</FieldLabel>
          <div className="w-fit">
            <Segmented
              label="Watch for"
              value={watchDays}
              onChange={setWatchDays}
              options={[
                { id: "14", label: "14 days" },
                { id: "30", label: "30 days" },
                { id: "90", label: "90 days" },
              ]}
            />
          </div>
        </div>
      )}

      <TextArea
        label={outcome === "inconclusive" ? "What you couldn’t confirm" : "Resolution summary"}
        required
        rows={3}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What happened, and what you did about it"
        error={tried && summaryShort ? `Too short: say what happened and what you did (${MIN_SUMMARY}+ characters).` : undefined}
      />

      {outcome === "confirmed_fraud" && (
        <div className="flex flex-col gap-2.5">
          {agent && <Checkbox label={`Report agent ${agent} to MoMo operations`} checked={reportAgent} onChange={(e) => setReportAgent(e.target.checked)} />}
          {ring && <Checkbox label={`Link ring ${ring} to this case`} checked={linkRing} onChange={(e) => setLinkRing(e.target.checked)} />}
        </div>
      )}
      {outcome === "inconclusive" && (
        <Checkbox label="Reopen automatically if a new alert fires on this number" checked={reopenOnRepeat} onChange={(e) => setReopenOnRepeat(e.target.checked)} />
      )}
      <RequestError error={failure} />
    </Modal>
  );
}

/** E5 · Resubmit after a send-back — shows what changed since it was submitted. */
export function ResubmitModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data: evidence } = useEvidence(detail.id);
  // The send-back is a banner on the case; the submission is a step in “What happened”.
  const sentBack = detail.banners.find((b) => b.kind === "sent_back");
  const submittedAt = detail.what_happened.findLast((s) => s.kind === "submitted")?.at ?? sentBack?.at ?? detail.opened.at;
  const since = sentBack?.at ?? submittedAt;
  const added = (evidence?.data ?? []).filter((e) => Date.parse(e.attached_at) > Date.parse(submittedAt));
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const first = sentBack?.by?.name.split(" ")[0] ?? "your supervisor";

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
      width={540}
      icon="app/icon-send-brand-22"
      tone="brand"
      title={`Resubmit ${detail.id} for sign-off`}
      description={`${first[0].toUpperCase()}${first.slice(1)} sent this back at ${formatClock(since)}. Here’s what changed.`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={busy} iconLeft={<Icon name="app/icon-send-white-18" size={18} />}>
            Resubmit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 rounded-[10px] bg-surface-raised px-3.5 py-3">
        <p className="text-overline text-text-tertiary uppercase">Changes since {formatClock(submittedAt)}</p>
        {added.length ? (
          added.map((e) => (
            <p key={e.id} className="flex items-center gap-2 text-body-s text-text-primary">
              <span className="text-success-fg">+</span>
              Evidence · {e.title}
            </p>
          ))
        ) : (
          <p className="text-body-s text-text-secondary">Nothing new yet. Add what was asked for first, or reply to explain.</p>
        )}
      </div>
      <TextArea label={`Reply to ${first}`} optional rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
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
  const [reason, setReason] = useState<string>(REOPEN_REASONS[0][0]);
  const [details, setDetails] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const outcome = r ? OUTCOMES.find((o) => o.id === r.outcome)?.title : "closed";

  const submit = async () => {
    setTried(true);
    if (!details.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const change = await apiFetch<CaseChange>("POST", `/cases/${detail.id}/reopen`, { reason: `${REOPEN_REASONS.find(([id]) => id === reason)?.[1]}: ${details}` });
      await mutate<CaseDetail>(`/cases/${detail.id}`, (c) => (c ? { ...c, ...change } : c), { revalidate: false });
      await mutate(`/cases/${detail.id}/timeline`);
      toast({ tone: "success", title: `${detail.id} reopened`, body: "It’s back in Investigating, assigned to you." });
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
      icon="app/icon-refresh-brand-22"
      tone="brand"
      title={`Reopen ${detail.id}?`}
      description={
        r
          ? `Closed ${formatDate(r.closed_at)} as ${outcome}${r.signed_off_by ? ` · signed off by ${r.signed_off_by.name}` : ""}`
          : "This case is closed."
      }
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} loading={busy} iconLeft={<Icon name="app/icon-refresh-white-18" size={18} />}>
            Reopen case
          </Button>
        </>
      }
    >
      <Select label="Why reopen?" required value={reason} onChange={(e) => setReason(e.target.value)}>
        {REOPEN_REASONS.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </Select>
      <TextArea
        label="Details"
        required
        rows={2}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        error={tried && !details.trim() ? "Say what changed." : undefined}
      />
      <Banner tone="info" title="Reopening returns it to Investigating, assigned to you">
        The original resolution{r?.signed_off_by ? ` and ${r.signed_off_by.name.split(" ")[0]}’s sign-off` : ""} stay on the record.
      </Banner>
      <RequestError error={failure} />
    </Modal>
  );
}


/** F1 · Close → monitor: what to watch, for how long, and what happens on a repeat. */
export function MonitorModal({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const first = detail.subject.name.split(" ")[0];
  const agent = detail.what_happened.find((s) => s.kind === "sim_swap")?.detail?.match(/AG-\d+/)?.[0];
  const things = [
    { id: detail.subject.subscriber_id, title: `${first}’s wallet and SIM`, detail: "Any new swap, new phone or big transfer", on: true },
    ...(agent ? [{ id: agent, title: `Agent ${agent}`, detail: "SIM swaps over 5 a day", on: true }] : []),
    // Not an entity: sent as `include_recipients`.
    { id: "recipients", title: "4 recipient wallets", detail: "Any money in from another victim", on: true },
    { id: "dev_4417", title: "Phone IMEI 35 209900 176148 7", detail: "If it shows up with another SIM", on: false },
  ];
  const [days, setDays] = useState<30 | 60 | 90>(90);
  const [picked, setPicked] = useState(() => new Set(things.filter((t) => t.on).map((t) => t.id)));
  const [then, setThen] = useState<"reopen" | "notify">("reopen");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const watch = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const watching = await apiFetch<Monitoring>("POST", `/cases/${detail.id}/monitor`, {
        days,
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
      width={620}
      title={
        <span className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-info-bg">
            <Icon name="app/icon-activity-info-22" size={22} />
          </span>
          <span className="flex flex-col gap-0.5">
            Keep watching after you close?
            <span className="text-body-m font-normal text-text-secondary">We’ll watch these and reopen the case if fraud repeats.</span>
          </span>
        </span>
      }
      actions={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            Close without watching
          </Button>
          <Button size="md" onClick={watch} loading={busy} disabled={!picked.size} iconLeft={<Icon name="app/icon-activity-white-18" size={18} />}>
            Close and watch {days} days
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <FieldLabel>For</FieldLabel>
        <div className="flex gap-2" role="radiogroup">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className={
                days === d
                  ? "h-10 rounded-lg border border-brand-primary bg-brand-primary-subtle px-4 text-label-m text-text-brand"
                  : "h-10 rounded-lg border border-border-default bg-surface-base px-4 text-label-m text-text-primary hover:bg-surface-raised"
              }
            >
              {d} days
            </button>
          ))}
        </div>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2">
          <FieldLabel>Watch</FieldLabel>
        </legend>
        {things.map((t) => (
          <Checkbox
            key={t.id}
            className="items-start"
            checked={picked.has(t.id)}
            onChange={(e) =>
              setPicked((p) => {
                const next = new Set(p);
                if (e.target.checked) next.add(t.id);
                else next.delete(t.id);
                return next;
              })
            }
            label={
              <span className="flex flex-col">
                <span className="text-body-m text-text-primary">{t.title}</span>
                <span className="text-caption text-text-secondary">{t.detail}</span>
              </span>
            }
          />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>If something happens</FieldLabel>
        </legend>
        {(
          [
            ["reopen", "app/icon-refresh-brand-22", "Reopen this case and tell me", "Best for confirmed fraud"],
            ["notify", "app/icon-bell-secondary-18", "Just tell me", "I’ll decide"],
          ] as const
        ).map(([id, icon, title, sub]) => (
          <label
            key={id}
            className={
              then === id
                ? "flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-brand-primary bg-brand-primary-subtle px-4 py-3.5"
                : "flex cursor-pointer items-center gap-3 rounded-xl border border-border-default px-4 py-3.5"
            }
          >
            <Icon name={icon} size={20} />
            <span className="flex flex-1 flex-col">
              <span className="text-body-m text-text-primary">{title}</span>
              <span className="text-caption text-text-secondary">{sub}</span>
            </span>
            <input
              type="radio"
              name="then"
              checked={then === id}
              onChange={() => setThen(id)}
              className="size-[18px] cursor-pointer appearance-none rounded-full border-[1.25px] border-border-strong checked:border-[5px] checked:border-brand-primary"
            />
          </label>
        ))}
      </fieldset>
      <RequestError error={failure} />
    </Modal>
  );
}
