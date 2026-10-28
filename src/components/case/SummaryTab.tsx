"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useNetwork, type CaseDetail, type NetworkNode, type NextStepKind, type StoryStep } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";
import type { ReactNode } from "react";
import { DetailRows, RowTile, StatTile, duration, firstName, localMsisdn } from "./parts";

const at = (s: StoryStep) => Date.parse(s.at);
const find = (steps: StoryStep[], kind: string) => steps.find((s) => s.kind === kind);

/** Marker labels on the time strip; kinds not listed get no marker. */
const MARKER: Record<string, string> = {
  sim_swap: "SIM swap",
  new_device: "new phone",
  wallets_paid: "last payment",
  picked_up: "you",
};

/** Time strip — markers at their real times, the money-out span as a red bar with its amount above, the latest (you) filled. */
function TimeStrip({ steps, out, from, to }: { steps: StoryStep[]; out?: string; from?: StoryStep; to?: StoryStep }) {
  const marks = steps.filter((s) => MARKER[s.kind]);
  // A case not picked up yet ends at its alert.
  if (!find(marks, "picked_up")) {
    const alert = find(steps, "alert_raised");
    if (alert) marks.push(alert);
  }
  if (marks.length < 2) return null;
  const t0 = at(marks[0]);
  const span = Math.max(1, at(marks[marks.length - 1]) - t0);
  const p = (s: StoryStep) => (at(s) - t0) / span;
  const x = (f: number) => `calc(${f} * (100% - 10px))`;
  return (
    <div className="relative h-[72px] w-full" aria-hidden>
      <span className="absolute top-[35px] right-[5px] left-[5px] h-0.5 bg-border-default" />
      {from && to && (
        <>
          <span className="absolute top-[34px] h-1 rounded-[2px] bg-critical-solid" style={{ left: `calc(${x(p(from))} + 5px)`, width: x(p(to) - p(from)) }} />
          {out && (
            <span
              className="absolute top-2.5 -translate-x-1/2 text-caption font-medium whitespace-nowrap text-critical-fg"
              style={{ left: `calc(${x((p(from) + p(to)) / 2)} + 5px)` }}
            >
              {out}
            </span>
          )}
        </>
      )}
      {marks.map((s, i) => {
        const last = i === marks.length - 1;
        // Before the money moved, the label ends at its marker so it clears the bar.
        const end = !last && i > 0 && from && at(s) <= at(from);
        return (
          <span key={s.at + s.kind}>
            <span
              className={cn("absolute top-[31px] size-2.5 rounded-full border-[1.5px]", last ? "border-text-primary bg-text-primary" : "border-border-strong bg-surface-base")}
              style={{ left: x(p(s)) }}
            />
            <span
              className={cn("absolute text-caption whitespace-nowrap text-text-secondary", last ? "top-2.5 -translate-x-full" : "top-[50px]", end && "-translate-x-full")}
              style={{ left: last || end ? `calc(${x(p(s))} + 10px)` : x(p(s)) }}
            >
              {formatClock(s.at)} {MARKER[s.kind] ?? "alert"}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** C2 · What happened — one line of story, the time strip, and the three times that matter. */
export function WhatHappened({ detail }: { detail: CaseDetail }) {
  const steps = [...detail.what_happened].sort((a, b) => at(a) - at(b));
  const swap = find(steps, "sim_swap");
  const phone = find(steps, "new_device");
  const from = find(steps, "payments_out");
  const to = [...steps].reverse().find((s) => s.kind === "wallets_paid") ?? from;
  const money = to?.amount ?? detail.glance.money.amount;
  const out = formatMoney(money.amount_minor, money.currency);

  // No money moved (an account takeover caught early, E8): the first event and the facts.
  if (!from || !to) {
    const first = steps[0];
    return (
      <Card title="What happened">
        {first && (
          <p className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
            <Badge label={first.label} tone="medium" />
            {[formatClock(first.at), first.detail].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-body-s text-text-primary">{detail.title}</p>
        <DetailRows rows={steps.slice(1).map((s) => [s.label, [formatClock(s.at), s.detail].filter(Boolean).join(" · ")])} />
      </Card>
    );
  }

  const lead = swap ? "SIM swap" : phone ? "New phone" : null;
  const span = duration(at(to) - at(from));
  const fr = detail.glance.first_response;
  const tiles: Array<[string, string]> = [
    ...(swap ? [["SIM swap to first payment", duration(at(from) - at(swap))] as [string, string]] : phone ? [["New phone to first payment", duration(at(from) - at(phone))] as [string, string]] : []),
    ["To empty the wallet", span],
    detail.status === "new" ? ["First response due within", `${fr.sla_minutes} min`] : ["Your first response", `${fr.minutes} min`],
  ];
  return (
    <Card title="What happened">
      <p className="text-h3 text-text-primary">{lead ? `${lead}, then ${out} out in ${span}` : `${out} out in ${span}`}</p>
      <TimeStrip steps={steps} out={`${out} out`} from={from} to={to} />
      <div className="flex gap-3">
        {tiles.map(([k, v]) => (
          <StatTile key={k} label={k} value={v} />
        ))}
      </div>
    </Card>
  );
}

const ROLE: Record<string, string> = {
  subject: "Subscriber",
  swap_agent: "Swap agent",
  new_device: "New device",
  recipient: "Recipient wallet",
};

/** Network mini — the seed, its swap agent and the wallets it paid; the path to the riskiest wallet is red. */
function NetworkMini({ seed, agent, wallets, risky }: { seed: string; agent?: NetworkNode; wallets: NetworkNode[]; risky?: string }) {
  const S = { x: 26, y: 126 };
  const A = { x: 112, y: 26 };
  const W = wallets.map((w, i) => ({ node: w, x: 216, y: 36 + i * 55 }));
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x} ${a.y} C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`;
  const node = (icon: string, x: number, y: number, red = false) => (
    <span
      className={cn(
        "absolute flex size-8 items-center justify-center rounded-full",
        red ? "border-[1.5px] border-critical-solid bg-critical-bg" : "border border-border-default bg-surface-raised",
      )}
      style={{ left: x - 16, top: y - 16 }}
    >
      <Icon name={icon} size={16} />
    </span>
  );
  return (
    <div className="relative h-[230px] w-[320px] shrink-0" aria-hidden>
      <svg width={320} height={230} className="absolute inset-0" fill="none">
        {agent && <path d={curve(S, A)} className="stroke-border-strong" strokeWidth={1} />}
        {W.filter((w) => w.node.id !== risky).map((w) => (
          <path key={w.node.id} d={curve(S, w)} className="stroke-border-strong" strokeWidth={1} />
        ))}
        {W.filter((w) => w.node.id === risky).map((w) => (
          <path key={w.node.id} d={curve(S, w)} className="stroke-critical-solid" strokeWidth={2} />
        ))}
      </svg>
      {node("app/icon-user-secondary-16", S.x, S.y)}
      <span className="absolute -translate-x-1/2 text-caption text-text-secondary" style={{ left: S.x, top: S.y + 22 }}>
        {seed}
      </span>
      {agent && (
        <>
          {node("app/icon-sim-secondary-16", A.x, A.y)}
          <span className="absolute text-caption text-text-secondary" style={{ left: A.x + 24, top: A.y - 9 }}>
            {agent.label}
          </span>
        </>
      )}
      {W.map((w) => (
        <span key={w.node.id}>
          {node(w.node.id === risky ? "app/icon-wallet-critical-16" : "app/icon-wallet-secondary-16", w.x, w.y, w.node.id === risky)}
          <span className="absolute text-caption whitespace-nowrap text-text-secondary" style={{ left: w.x + 24, top: w.y - 9 }}>
            {w.node.label}
          </span>
        </span>
      ))}
    </div>
  );
}

/** C2 · Who’s involved — the first hop around the subscriber, drawn and listed. */
export function WhoInvolved({ detail, onOpenNetwork }: { detail: CaseDetail; onOpenNetwork: () => void }) {
  const { data } = useNetwork(detail.subject.subscriber_id, 1);
  const nodes = (data?.nodes ?? []).filter((n) => n.id !== detail.subject.subscriber_id);
  const agent = nodes.find((n) => n.relation === "swap_agent");
  const device = nodes.find((n) => n.relation === "new_device");
  const wallets = nodes.filter((n) => n.type === "wallet" && (n.relation ?? "recipient") === "recipient");
  const risky = wallets.find((w) => w.case_ids?.length) ?? wallets.find((w) => w.risk === "confirmed");
  const others = wallets.filter((w) => w !== risky);
  // “Agent AG-2231, Adum” → “Adum”.
  const where = detail.what_happened.find((s) => s.kind === "sim_swap")?.detail?.split(",")[1]?.trim();

  const rows: Array<{ name: string; role: string; value: ReactNode }> = [
    { name: detail.subject.name, role: ROLE.subject, value: localMsisdn(detail.subject.msisdn) },
    ...(agent ? [{ name: agent.label, role: ROLE.swap_agent, value: where ?? "" }] : []),
    ...(risky
      ? [{ name: risky.label, role: ROLE.recipient, value: risky.case_ids?.[0] ? <Badge label={`${risky.case_ids[0]} · same wallet`} tone="critical" /> : "" }]
      : []),
    ...(others.length
      ? [{ name: `${others.length} more ${others.length === 1 ? "wallet" : "wallets"}`, role: "Recipient wallets", value: others.map((w) => w.label.slice(0, 3)).join(", ") }]
      : []),
    ...(device ? [{ name: device.label, role: ROLE.new_device, value: "" }] : []),
  ];

  return (
    <Card
      title="Who’s involved"
      aside={
        <button type="button" onClick={onOpenNetwork} className="flex h-8 items-center rounded text-label-s text-text-brand hover:underline">
          Open network
        </button>
      }
    >
      {data ? (
        <div className="flex items-center gap-8">
          <NetworkMini seed={detail.subject.name} agent={agent} wallets={(risky ? [risky, ...others] : others).slice(0, 4)} risky={risky?.id} />
          <ul className="flex min-w-0 flex-1 flex-col">
            {rows.map((r) => (
              <li key={r.name + r.role} className="flex h-[52px] items-center gap-3 border-b border-border-default py-2 last:border-b-0">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label-s text-text-primary">{r.name}</span>
                  <span className="text-caption text-text-secondary">{r.role}</span>
                </span>
                {typeof r.value === "string" ? <span className="text-body-s text-text-secondary">{r.value}</span> : r.value}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="h-[230px] text-body-s text-text-secondary">Loading who’s involved…</p>
      )}
    </Card>
  );
}

/** Steps that mean the response is done and the case is waiting on someone else. */
const AFTER_RESPONSE: NextStepKind[] = ["wait", "watch_repeat", "none"];

const STEP: Partial<Record<NextStepKind, { icon: string; title: string; verb: string }>> = {
  start: { icon: "app/icon-clock-secondary-18", title: "Start investigating", verb: "Start" },
  pick_up: { icon: "app/icon-users-secondary-18", title: "Pick up this case", verb: "Pick up" },
  freeze_wallet: { icon: "app/icon-shield-primary-18", title: "Freeze the wallet", verb: "Freeze" },
  suspend_sim: { icon: "app/icon-sim-18", title: "Suspend the SIM", verb: "Suspend" },
  block_recipients: { icon: "app/icon-ban-18", title: "Block recipient wallets", verb: "Block" },
  call_subscriber: { icon: "app/icon-phone-secondary-18", title: "Call the subscriber", verb: "Call" },
  request_reversal: { icon: "app/icon-refresh-secondary-18", title: "Request a reversal", verb: "Request" },
  report_agent: { icon: "app/icon-user-x-secondary-18", title: "Report the agent", verb: "Report" },
  agent_suspension: { icon: "app/icon-user-x-secondary-18", title: "Report the agent", verb: "Report" },
  link_case: { icon: "app/icon-link-16", title: "Link a case", verb: "Link" },
  add_evidence: { icon: "app/icon-file-secondary-18", title: "Add evidence", verb: "Add" },
  wait: { icon: "app/icon-clock-secondary-18", title: "Wait for sign-off", verb: "Remind" },
  watch_repeat: { icon: "app/icon-eye-primary-18", title: "Watch for a repeat", verb: "Set up" },
  none: { icon: "app/icon-check-circle-secondary-18", title: "Nothing to do", verb: "" },
};
const stepOf = (k: NextStepKind) => STEP[k] ?? { icon: "app/icon-file-secondary-18", title: k.replace(/_/g, " "), verb: "Open" };

/** The main button on the recommended step. */
function primaryLabel(kind: NextStepKind, title: string) {
  switch (kind) {
    case "call_subscriber":
      return "Log a call";
    case "freeze_wallet":
      return "Freeze wallet";
    case "suspend_sim":
      return "Suspend SIM";
    case "block_recipients":
      return "Block wallets";
    case "request_reversal":
      return "Request reversal";
    case "report_agent":
    case "agent_suspension":
      return "Report agent";
    case "add_evidence":
      return "Go to Evidence";
    case "watch_repeat":
      return "Set up monitoring";
    case "start":
      return "Start investigating";
    case "pick_up":
      return "Pick up";
    case "link_case":
      return `Link ${title.match(/FD-\d+/)?.[0] ?? "case"}`;
    case "wait": {
      // “Waiting for Efua’s sign-off” → “Remind Efua”.
      const who = title.match(/for (\p{L}+)[’']s/u)?.[1];
      return who ? `Remind ${who}` : "Send a reminder";
    }
    default:
      return stepOf(kind).verb;
  }
}

export type RetryStep = { title: string; detail: string; busy: boolean; run: () => void };

/** C2 · Do this next — one primary step (the page’s main action), then the rest; done steps carry a tick. */
export function DoThisNext({
  detail,
  onStep,
  locked,
  retry,
}: {
  detail: CaseDetail;
  onStep: (kind: NextStepKind) => void;
  locked?: boolean;
  /** D5 · a protective action part failed: retrying it comes first. */
  retry?: RetryStep | null;
}) {
  const steps = detail.next_steps;
  const rec = steps.recommended;
  const total = steps.done.length + steps.remaining.length + (rec ? 1 : 0);
  const meta = detail.rejection
    ? "Reopened"
    : detail.status === "sent_back"
      ? "Changes requested"
      : rec && AFTER_RESPONSE.includes(rec.kind)
        ? "Response complete"
        : `${steps.done.length} of ${total} done`;
  const amount = detail.glance.money.amount;
  const agent = detail.what_happened.find((s) => s.kind === "sim_swap")?.detail?.replace(/^Agent /, "").replace(", ", " · ");
  const protectedAt = detail.latest_action?.requested_at;
  const sub: Partial<Record<NextStepKind, string>> = {
    call_subscriber: detail.contact?.alt_msisdn ?? localMsisdn(detail.subject.msisdn),
    request_reversal: formatMoney(amount.amount_minor, amount.currency),
    report_agent: agent,
    agent_suspension: agent,
    freeze_wallet: detail.glance.money.note,
    suspend_sim: localMsisdn(detail.subject.msisdn),
  };
  const always = ["wait", "watch_repeat", "start", "pick_up", "add_evidence"];

  return (
    <Card title="Do this next" aside={<CardMeta>{meta}</CardMeta>}>
      <div className="flex flex-col">
        {retry ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-raised p-4">
            <div className="flex items-center gap-3">
              <RowTile icon="app/icon-sim-18" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-label-s text-text-primary">{retry.title}</span>
                <span className="text-caption text-text-secondary">{retry.detail}</span>
              </span>
            </div>
            <Button size="md" fullWidth loading={retry.busy} onClick={retry.run}>
              Retry
            </Button>
          </div>
        ) : rec ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-raised p-4">
            <div className="flex items-center gap-3">
              <RowTile icon={stepOf(rec.kind).icon} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-label-s text-text-primary">{rec.title}</span>
                <span className="text-caption text-text-secondary">{rec.detail}</span>
              </span>
            </div>
            {rec.kind !== "none" && (
              <Button size="md" fullWidth disabled={locked && !always.includes(rec.kind)} onClick={() => onStep(rec.kind)}>
                {primaryLabel(rec.kind, rec.title)}
              </Button>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised p-4 text-label-s text-text-primary">
            <Icon name="app/icon-check-circle-success-18" size={18} />
            All suggested steps are done. Resolve the case when you’re ready.
          </p>
        )}
        {(steps.remaining.length > 0 || steps.done.length > 0 || (detail.rejection?.steps.length ?? 0) > 0) && (
          <>
            <p className="pt-4 pb-1 text-caption text-text-tertiary">Then</p>
            <ul className="flex flex-col">
              {steps.remaining.map((k) => (
                <li key={k} className="flex h-[60px] items-center gap-3 border-b border-border-default py-3 last:border-b-0">
                  <RowTile icon={stepOf(k).icon} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-label-s text-text-primary">{stepOf(k).title}</span>
                    {sub[k] && <span className="truncate text-caption text-text-secondary">{sub[k]}</span>}
                  </span>
                  <Button variant="secondary" size="sm" disabled={locked} onClick={() => onStep(k)}>
                    {stepOf(k).verb}
                  </Button>
                </li>
              ))}
              {detail.rejection?.steps.map((s) => (
                <li key={s} className="flex h-[60px] items-center gap-3 border-b border-border-default py-3 last:border-b-0">
                  <RowTile icon="app/icon-circle-dashed-14" size={14} />
                  <span className="min-w-0 flex-1 text-label-s text-text-primary">{s}</span>
                </li>
              ))}
              {steps.done.map((k) => (
                <li key={k} className="flex h-[60px] items-center gap-3 border-b border-border-default py-3 last:border-b-0">
                  <RowTile icon="app/icon-check-circle-secondary-18" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-label-s text-text-primary">{stepOf(k).title}</span>
                    <span className="text-caption text-text-secondary">
                      {["freeze_wallet", "suspend_sim", "block_recipients"].includes(k) && protectedAt ? `Done ${formatClock(protectedAt)}` : "Done"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/** C2 · Other actions — neutral rows that open a modal or a tab. */
export function OtherActions({
  onNote,
  onEscalate,
  onHandover,
  escalated,
  supervisor,
  readOnly,
}: {
  onNote: () => void;
  onEscalate: () => void;
  onHandover: () => void;
  /** An escalation is waiting: say who it went to. */
  escalated?: boolean;
  supervisor?: string;
  /** Pending sign-off or closed: only notes can be added. */
  readOnly?: boolean;
}) {
  const rows: Array<[string, string, () => void, boolean?]> = [
    ["app/icon-message-primary-16", "Add a note", onNote],
    ["app/icon-alert-circle-secondary-16", escalated ? `Escalated to ${firstName(supervisor) || "your supervisor"}` : "Escalate to supervisor", onEscalate, escalated || readOnly],
    ["app/icon-user-secondary-16", "Hand to a colleague", onHandover, readOnly],
  ];
  return (
    <Card title="Other actions">
      <ul className="flex flex-col">
        {rows.map(([icon, label, run, disabled]) => (
          <li key={icon} className="border-t border-border-default first:border-t-0">
            <button
              type="button"
              onClick={run}
              disabled={disabled}
              className="flex h-11 w-full items-center gap-2.5 py-3 text-left text-body-s text-text-primary hover:text-text-brand disabled:cursor-not-allowed disabled:text-text-tertiary"
            >
              <Icon name={icon} size={16} />
              <span className="flex-1">{label}</span>
              <Icon name="app/icon-chevron-right-tertiary-16" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
