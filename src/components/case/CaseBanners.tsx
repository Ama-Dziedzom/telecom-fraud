"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useAction, useReversal, type CaseDetail, type Escalation, type Reversal } from "@/lib/api/cases";
import { useApi, type TransactionPage } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { partError, partLabel } from "./ProtectDialogs";
import { BannerLink, StepList, firstName, table, type StepState } from "./parts";

const money = (m: { amount_minor: number; currency: string }) => formatMoney(m.amount_minor, m.currency);

/** The latest protective action when part of it failed (D5), and a way to retry it. */
export function useActionRetry(detail: CaseDetail | undefined) {
  const { mutate } = useSWRConfig();
  const [retrying, setRetrying] = useState(false);
  const partial = detail?.latest_action?.status === "partial";
  // The case only says how the action went; its parts come from the action.
  const { data: action } = useAction(partial ? detail.latest_action?.id : null);
  const failed = action?.parts.find((p) => p.status === "failed");
  const retry = async () => {
    if (!action || !detail) return;
    setRetrying(true);
    try {
      await apiFetch("POST", `/actions/${action.id}/retry`);
      // Let the retry run, then show the result.
      for (let i = 0; i < 4; i++) await apiFetch("GET", `/actions/${action.id}`);
      await mutate(`/cases/${detail.id}`);
      await mutate(`/cases/${detail.id}/timeline`);
    } finally {
      setRetrying(false);
    }
  };
  return partial && action && failed ? { action, failed, retry, retrying } : null;
}

/** D5 · Partial failure — what went through, what didn’t, and Retry now. */
export function ActionBanner({ retry }: { retry: ReturnType<typeof useActionRetry> }) {
  if (!retry) return null;
  const { action: a, failed } = retry;
  const applied = a.parts.filter((p) => p.status === "applied").length;
  const sim = failed.kind === "suspend_sim";
  return (
    <Banner
      tone="error"
      title={`${applied} of ${a.parts.length} actions applied.${sim ? " The SIM is still active" : ""}`}
      action={
        <BannerLink onClick={retry.retry} busy={retry.retrying}>
          {retry.retrying ? "Retrying…" : "Retry now"}
        </BannerLink>
      }
    >
      {partLabel(failed, "failed")} failed: {partError(failed.code).replace(/^./, (c) => c.toLowerCase())}
      {failed.reference ? ` (${failed.reference})` : ""}.{sim ? " The fraudster may still get SMS on this number." : ""} Retrying in 2 min.
    </Banner>
  );
}

const TARGET_LABEL: Record<Escalation["target"], string> = { supervisor: "Fraud supervisor", legal: "Legal and compliance", momo_ops: "MoMo operations" };
const ANSWER_LABEL: Record<Exclude<Escalation["status"], "waiting">, string> = { approved: "Approved", declined: "Declined" };
/** “Approved” — how a supervisor answered. */
export const escalationAnswer = (status: Escalation["status"]) => (status === "waiting" ? "Waiting" : (ANSWER_LABEL[status] ?? status));

/** D12/D13 · Escalation waiting (Withdraw) or answered (Reply). */
export function EscalationBanner({ detail }: { detail: CaseDetail }) {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const e = detail.escalation;
  if (!e) return null;
  if (e.status === "waiting") {
    return (
      <Banner
        tone="info"
        title={`Escalated to ${e.to.name} (${TARGET_LABEL[e.target] ?? e.target}) · ${e.priority[0].toUpperCase()}${e.priority.slice(1)}`}
        action={
          <BannerLink
            busy={busy}
            onClick={async () => {
              setBusy(true);
              await apiFetch("DELETE", `/escalations/${e.id}`).catch(() => undefined);
              await mutate(`/cases/${detail.id}`);
              setBusy(false);
            }}
          >
            Withdraw
          </BannerLink>
        }
      >
        “{e.question}” Sent {formatClock(e.sent_at)} · reply due by {formatClock(e.reply_due_at)}
      </Banner>
    );
  }
  // “Suspend agent AG-2231 for 7 days: …” → “agent AG-2231”.
  const what = e.kind === "agent_suspension" ? e.question.match(/^Suspend (agent \S+)/i)?.[1] : null;
  return (
    <Banner
      tone={e.status === "approved" ? "success" : "warning"}
      title={`${firstName(e.to.name)} ${escalationAnswer(e.status).toLowerCase()}${what ? `: suspend ${what}` : " your escalation"}`}
      // TODO(api): no messaging endpoint; Reply stays disabled.
      action={
        <BannerLink disabled title="Messaging isn’t available yet">
          Reply
        </BannerLink>
      }
    >
      {e.answer ? `“${e.answer}”` : "See the answer on the timeline."}
    </Banner>
  );
}

/** Offered to a colleague, waiting for them to accept (D15). */
export function HandoverBanner({ detail }: { detail: CaseDetail }) {
  const h = detail.handover;
  if (!h || h.status !== "offered") return null;
  return (
    <Banner tone="info" title={`Offered to ${h.to.name} · waiting for them to accept`}>
      “{h.note}” The case stays with you until they accept.
    </Banner>
  );
}

const STEP_LABEL: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted by MoMo ops",
  held: "Funds held",
  closed: "Closed",
};

/** D9 · Reversal tracking — where the money is on its way back. */
export function ReversalCard({ id, subject }: { id: string; subject: string }) {
  const { data } = useReversal(id);
  if (!data || data.status === "closed") return null;
  const current = data.steps.findIndex((s) => !s.at);
  const returning = data.steps.find((s) => s.step === "returning");
  const label = (s: Reversal["steps"][number]) => {
    const name = s.step === "returning" ? `Returning to ${subject}’s wallet` : (STEP_LABEL[s.step] ?? s.step);
    const time = s.at ? ` ${formatClock(s.at)}` : "";
    const by = s.step === "requested" ? " by you" : "";
    const tail = s.step === "accepted" ? s.by : s.step === "closed" && !s.at ? "the final amount is added to the case" : s.detail;
    return `${name}${time}${by}${tail ? ` · ${tail}` : ""}`;
  };
  return (
    <Card
      title={`Reversal ${data.id}`}
      aside={
        <span className="flex items-center gap-4">
          <CardMeta>
            {money(data.secured)} of {money(data.requested).replace("GHS ", "")} held
            {returning?.detail ? ` · ${returning.detail}` : ""}
          </CardMeta>
          {/* TODO(api): no messaging endpoint. */}
          <BannerLink disabled title="Messaging isn’t available yet">
            Message MoMo ops
          </BannerLink>
        </span>
      }
    >
      <StepList
        steps={data.steps.map((s, i) => ({
          state: (s.at ? "done" : i === current ? "current" : "todo") as StepState,
          label: label(s),
        }))}
      />
    </Card>
  );
}

type ReversalResult = NonNullable<Reversal["results"]>[number];
const RESULT: Record<ReversalResult["result"], (r: ReversalResult) => { label: string; tone: "success" | "critical" | "high" | "neutral" }> = {
  recovered: (r) => ({ label: `Recovered ${money(r.recovered)}`, tone: "success" }),
  cashed_out: () => ({ label: "Cashed out, nothing left", tone: "critical" }),
  declined: (r) => ({ label: `Declined · ${r.reason ?? "no reason given"}`, tone: "high" }),
  pending: () => ({ label: "Pending", tone: "neutral" }),
};

/** D10 · Reversal closed: what came back, what didn’t, and what you can do about it. */
export function ReversalResults({ id }: { id: string }) {
  const toast = useToast();
  const { data } = useReversal(id);
  const { data: txs } = useApi<TransactionPage>(data ? `/cases/${data.case_id}/transactions` : null);
  if (!data || data.status !== "closed" || !data.results) return null;
  const results = data.results;
  const recovered = results.reduce((s, r) => s + r.recovered.amount_minor, 0);
  const sent = results.reduce((s, r) => s + r.sent.amount_minor, 0);
  const lost = sent - recovered;
  const declined = results.filter((r) => r.result === "declined");
  const cashed = results.filter((r) => r.result === "cashed_out").length;
  const closedAt = data.steps.find((s) => s.step === "closed")?.at;
  const timeOf = (paymentId: string) => {
    const t = txs?.data.find((x) => x.id === paymentId);
    return t ? formatClock(t.at) : "";
  };
  return (
    <>
      <Banner tone="warning" title={`${data.id} closed: ${formatMoney(recovered, "GHS")} of ${formatMoney(sent, "GHS").replace("GHS ", "")} recovered`}>
        {cashed} transfers were already cashed out.{declined.length ? ` MoMo ops declined one: ${declined[0].to.toLowerCase()} disputes it.` : ""} Appeal with evidence or accept the loss.
      </Banner>
      <Card title={`${data.id} results`} aside={closedAt ? <CardMeta>Closed {formatClock(closedAt)}</CardMeta> : undefined}>
        <div className={table.wrap}>
          <table className="w-full">
            <thead>
              <tr className={table.head}>
                <th className="w-[88px] pl-4 font-normal">Time</th>
                <th className="w-[150px] font-normal">Reference</th>
                <th className="font-normal">To</th>
                <th className="text-right font-normal">Sent</th>
                <th className="w-[230px] pr-4 pl-6 font-normal">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const res = RESULT[r.result](r);
                return (
                  <tr key={r.payment_id} className={cn(table.row, "text-body-s text-text-primary")}>
                    <td className="pl-4">{timeOf(r.payment_id)}</td>
                    <td>{r.payment_id}</td>
                    <td>{r.to}</td>
                    <td className="text-right tabular-nums">{money(r.sent)}</td>
                    <td className="pr-4 pl-6">
                      <Badge label={res.label} tone={res.tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4">
          {declined.length > 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                // The appeal quotes the decline; the evidence for it goes on the Evidence tab.
                void apiFetch("POST", `/reversals/${data.id}/appeal`, { reason: declined[0]?.reason ?? "Funds were still in the recipient wallet." }).catch(() => undefined);
                toast({ title: "Appeal started", body: "Attach evidence on the Evidence tab; MoMo ops will review it." });
              }}
            >
              Appeal the decline
            </Button>
          )}
          {lost > 0 && (
            <BannerLink
              onClick={async () => {
                const r = await apiFetch<{ accepted_loss: { amount_minor: number; currency: string } }>("POST", `/reversals/${data.id}/accept-loss`, {}).catch(() => null);
                toast({ tone: "success", title: `Loss of ${r ? money(r.accepted_loss) : formatMoney(lost, "GHS")} accepted`, body: "It will be recorded when you resolve the case." });
              }}
            >
              Accept {formatMoney(lost, "GHS")} loss
            </BannerLink>
          )}
        </div>
      </Card>
    </>
  );
}

/** E12 · One-click export — every export is logged against your name. */
export function ExportMenu({ detail }: { detail: CaseDetail }) {
  const toast = useToast();
  const items = [
    { id: "report", icon: "app/icon-file-secondary-18", title: "Case report · PDF", detail: "Summary, timeline, outcome · 8 pages" },
    { id: "transactions", icon: "app/icon-file-secondary-18", title: "Transactions · CSV", detail: `${detail.counts?.transactions ?? 0} rows · opens in Excel` },
    { id: "evidence", icon: "app/icon-folder-secondary-16", title: "Evidence pack · ZIP", detail: `Report, ${detail.counts?.evidence ?? 0} evidence files and hashes` },
  ];
  const run = async (id: string) => {
    if (id === "evidence") {
      await apiFetch("POST", "/exports/evidence-pack", { case_id: detail.id }).catch(() => undefined);
    }
    // TODO(api): 0.2 still has no case report PDF or transactions CSV; only the brief and the evidence pack export.
    toast({ tone: "success", title: "Export started", body: `${items.find((i) => i.id === id)?.title} for ${detail.id}. We’ll let you know when it’s ready.` });
  };
  return (
    <Menu
      label={`Export ${detail.id}`}
      width={280}
      trigger={(t) => (
        <Button variant="secondary" size="sm" onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu" iconLeft={<Icon name="app/icon-download-18" size={16} />}>
          Export
        </Button>
      )}
    >
      {(close) => (
        <>
          {items.map((i) => (
            <MenuItem
              key={i.id}
              icon={i.icon}
              title={i.title}
              description={i.detail}
              onSelect={() => {
                close();
                void run(i.id);
              }}
            />
          ))}
          <p className="border-t border-border-default px-2.5 pt-2.5 pb-1 text-caption text-text-secondary">Numbers stay masked. Every export is logged with your name.</p>
        </>
      )}
    </Menu>
  );
}
