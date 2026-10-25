"use client";

import { Card } from "@/components/app/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, Spinner } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useReversal, type CaseDetail, type Reversal } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { partLabel } from "./ProtectDialogs";

const money = (m: { amount_minor: number; currency: string }) => formatMoney(m.amount_minor, m.currency);

/** D4/D5 · After a protective action: green “Subscriber protected”, or a red list with the part that failed. */
export function ActionBanner({ detail }: { detail: CaseDetail }) {
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [retrying, setRetrying] = useState(false);
  const a = detail.latest_action;
  if (!a || a.status !== "partial") return null;
  const applied = a.parts.filter((p) => p.status === "applied").length;
  const failed = a.parts.find((p) => p.status === "failed");

  const retry = async () => {
    setRetrying(true);
    try {
      await apiFetch("POST", `/actions/${a.id}/retry`);
      // Let the retry run, then show the result.
      for (let i = 0; i < 4; i++) await apiFetch("GET", `/actions/${a.id}`);
      await mutate(`/cases/${detail.id}`);
      await mutate(`/cases/${detail.id}/timeline`);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section role="alert" className="flex flex-col gap-3 rounded-xl border border-critical-border bg-critical-bg px-4 py-3.5">
      <p className="flex items-center gap-2 text-label-m text-critical-fg">
        <Icon name="icon-alert-triangle-critical-24" size={18} />
        {applied} of {a.parts.length} actions applied{failed?.kind === "suspend_sim" ? ": the SIM is still active" : ""}
      </p>
      <ul className="flex flex-col gap-2.5">
        {a.parts.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={cn("mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full", p.status === "applied" ? "bg-success-fg" : "bg-critical-fg")}>
              <Icon name={p.status === "applied" ? "app/icon-check-white-10" : "app/icon-x-white-18"} size={10} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={cn("text-label-m", p.status === "applied" ? "text-text-primary" : "text-critical-fg")}>
                {p.status === "applied" ? partLabel(p, "done") : `${partLabel(p, "failed")} failed`}
              </span>
              {p.status === "failed" ? (
                <span className="max-w-[460px] text-caption text-critical-fg">
                  {(p as { detail?: string }).detail ?? "It didn’t go through"} · error {p.code}. {p.kind === "suspend_sim" ? "The fraudster may still receive SMS on this number." : ""}
                </span>
              ) : (
                (p as { detail?: string }).detail && <span className="text-caption text-text-secondary">{(p as { detail?: string }).detail}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Button variant="danger" size="sm" loading={retrying} onClick={retry} iconLeft={<Icon name="app/icon-refresh-white-16" size={16} />}>
          Retry {failed ? partLabel(failed, "failed").replace(/^Wallet/, "wallet") : ""}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            // TODO(api): proposed POST /actions/{id}/noc-ticket.
            void apiFetch("POST", `/actions/${a.id}/noc-ticket`).catch(() => undefined);
            toast({ title: "Raised with the NOC", body: "Network operations will look at the provisioning failure." });
          }}
          iconLeft={<Icon name="app/icon-escalate-18" size={16} />}
        >
          Raise with NOC
        </Button>
        <span className="text-caption text-text-secondary">Retrying automatically in 2 min</span>
      </div>
    </section>
  );
}

/** D12/D13 · Escalation waiting or answered. */
export function EscalationBanner({ detail }: { detail: CaseDetail }) {
  const { mutate } = useSWRConfig();
  const e = detail.escalation;
  if (!e) return null;
  const waiting = e.status === "waiting";
  return (
    <section className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", waiting ? "border-info-border bg-info-bg" : "border-border-subtle bg-brand-primary-subtle")}>
      <Avatar initials={e.to.initials} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-2 text-label-m text-text-brand">
          {waiting ? `Escalated to ${e.to.name}${e.to.role ? ` (${e.to.role})` : ""} · ${e.priority[0].toUpperCase()}${e.priority.slice(1)}` : `${e.to.name.split(" ")[0]} answered your escalation`}
          {!waiting && e.answered_at && <span className="text-caption text-text-tertiary">{formatClock(e.answered_at)}</span>}
          {!waiting && e.answer && <Badge label={e.answer.label} tone="info" />}
        </p>
        <p className="text-body-s text-text-primary">
          {waiting ? `“${e.question}” Sent ${formatClock(e.sent_at)} · reply due by ${formatClock(e.reply_due_at)}.` : e.answer?.comment}
        </p>
      </div>
      {/* TODO(api): no messaging endpoint; Message/Reply stay disabled. */}
      <Button variant="secondary" size="sm" disabled title="Messaging isn’t available yet" iconLeft={<Icon name="app/icon-message-18" size={16} />}>
        {waiting ? `Message ${e.to.name.split(" ")[0]}` : "Reply"}
      </Button>
      {waiting && (
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            // TODO(api): proposed DELETE /escalations/{id}.
            await apiFetch("DELETE", `/escalations/${e.id}`).catch(() => undefined);
            await mutate(`/cases/${detail.id}`);
          }}
        >
          Withdraw
        </Button>
      )}
    </section>
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
  held: "Funds held in 2 recipient wallets",
  returning: "Returning to victim’s wallet",
  closed: "Closed",
};

/** D9 · Reversal tracking on the summary. */
export function ReversalCard({ id }: { id: string }) {
  const { data } = useReversal(id);
  if (!data || data.status === "closed") return null;
  const current = data.steps.findIndex((s) => !s.at);
  return (
    <Card
      title={`Reversal ${data.id}`}
      icon="app/icon-refresh-16"
      aside={
        // TODO(api): no messaging endpoint.
        <Button variant="secondary" size="sm" disabled title="Messaging isn’t available yet" iconLeft={<Icon name="app/icon-message-18" size={16} />}>
          Message MoMo ops
        </Button>
      }
    >
      <p className="flex items-center gap-2">
        <Badge label="In progress" tone="info" dot />
        <span className="text-label-s text-success-fg">
          {money(data.secured)} of {money(data.requested).replace("GHS ", "")} secured
        </span>
      </p>
      <ol className="flex flex-col gap-3">
        {data.steps.map((s, i) => (
          <li key={s.step} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center">
              {s.at ? (
                <span className="flex size-[18px] items-center justify-center rounded-full bg-success-fg">
                  <Icon name="app/icon-check-white-10" size={10} />
                </span>
              ) : i === current ? (
                <Spinner tone="brand" />
              ) : (
                <span className="size-[18px] rounded-full border-[1.5px] border-border-default" />
              )}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={cn("text-label-m", s.at || i === current ? "text-text-primary" : "text-text-tertiary")}>
                {s.step === "requested" ? `Requested · ${s.at ? formatClock(s.at) : ""} by you` : `${STEP_LABEL[s.step] ?? s.step}${s.at ? ` · ${formatClock(s.at)}` : ""}`}
              </span>
              <span className="text-caption text-text-secondary">
                {s.step === "requested" ? `${data.id} · ${s.detail}` : s.step === "accepted" ? s.by : s.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const RESULT: Record<Reversal["results"][number]["result"], (r: Reversal["results"][number]) => { label: string; tone: "success" | "critical" | "medium" | "neutral" }> = {
  recovered: (r) => ({ label: `Recovered ${money(r.recovered)}`, tone: "success" }),
  cashed_out: () => ({ label: "Cashed out · nothing left", tone: "critical" }),
  declined: (r) => ({ label: `Declined · ${r.reason ?? "no reason given"}`, tone: "medium" }),
  pending: () => ({ label: "Pending", tone: "neutral" }),
};

/** D10 · Reversal closed: what came back, what didn’t, and what you can do about it. */
export function ReversalResults({ id }: { id: string }) {
  const toast = useToast();
  const { data } = useReversal(id);
  if (!data || data.status !== "closed") return null;
  const recovered = data.results.reduce((s, r) => s + r.recovered.amount_minor, 0);
  const sent = data.results.reduce((s, r) => s + r.sent.amount_minor, 0);
  const lost = sent - recovered;
  const declined = data.results.filter((r) => r.result === "declined");
  const cashed = data.results.filter((r) => r.result === "cashed_out").length;
  return (
    <>
      <Banner tone="warning" title={`${data.id} closed · ${formatMoney(recovered, "GHS")} of ${formatMoney(sent, "GHS").replace("GHS ", "")} recovered`}>
        {cashed} transfers were already cashed out.{declined.length ? ` MoMo ops declined one (${declined[0].to.toLowerCase()} disputes it).` : ""} You can appeal with evidence or accept the loss.
      </Banner>
      <Card title={`${data.id} · results`} icon="app/icon-refresh-16">
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          <table className="w-full text-left">
            <thead className="border-b border-border-subtle bg-surface-raised">
              <tr className="text-overline text-text-tertiary uppercase">
                <th className="py-2.5 pl-4 font-bold">Time</th>
                <th className="py-2.5 font-bold">Reference</th>
                <th className="py-2.5 font-bold">To</th>
                <th className="py-2.5 text-right font-bold">Sent</th>
                <th className="py-2.5 pr-4 pl-6 font-bold">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => {
                const res = RESULT[r.result](r);
                return (
                  <tr key={r.payment_id} className="border-b border-border-subtle last:border-b-0">
                    <td className="py-2.5 pl-4 font-mono text-mono-s text-text-primary">
                      {r.payment_id.includes("8941") ? "08:41" : r.payment_id.includes("8945") ? "08:45" : r.payment_id.includes("8953") ? "08:53" : r.payment_id.includes("8958") ? "08:58" : "09:03"}
                    </td>
                    <td className="py-2.5 font-mono text-mono-s text-text-tertiary">{r.payment_id}</td>
                    <td className="py-2.5 font-mono text-mono-m text-text-primary">{r.to}</td>
                    <td className="py-2.5 text-right font-mono text-mono-m text-text-primary">{money(r.sent)}</td>
                    <td className="py-2.5 pr-4 pl-6">
                      <Badge label={res.label} tone={res.tone} dot />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // TODO(api): proposed POST /reversals/{id}/appeal.
              void apiFetch("POST", `/reversals/${data.id}/appeal`).catch(() => undefined);
              toast({ title: "Appeal started", body: "Attach evidence on the Evidence tab; MoMo ops will review it." });
            }}
            iconLeft={<Icon name="app/icon-file-plus-16" size={16} />}
          >
            Appeal the decline
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // TODO(api): proposed POST /reversals/{id}/accept-loss.
              void apiFetch("POST", `/reversals/${data.id}/accept-loss`).catch(() => undefined);
              toast({ tone: "success", title: `Loss of ${formatMoney(lost, "GHS")} accepted`, body: "It will be recorded when you resolve the case." });
            }}
          >
            Accept {formatMoney(lost, "GHS")} loss
          </Button>
        </div>
      </Card>
    </>
  );
}

/** E12 · Export menu — every export is logged against your name. */
export function ExportMenu({ detail }: { detail: CaseDetail }) {
  const toast = useToast();
  const items = [
    { id: "report", icon: "app/icon-file-secondary-18", title: "Case report · PDF", detail: "Summary, story, timeline, outcome · 8 pages" },
    { id: "story", icon: "app/icon-play-story-18", title: "Story · PDF or images", detail: "The 6 chapters, for meetings" },
    { id: "transactions", icon: "app/icon-chart-secondary-18", title: "Transactions · CSV", detail: `${detail.counts?.transactions ?? 0} rows, opens in Excel` },
    { id: "evidence", icon: "app/icon-folder-secondary-16", title: "Evidence pack · ZIP", detail: `Report + ${detail.counts?.evidence ?? 0} evidence files + hashes` },
  ];
  const run = async (id: string) => {
    if (id === "evidence") {
      await apiFetch("POST", "/exports/evidence-pack", { case_id: detail.id }).catch(() => undefined);
    }
    // TODO(api): proposed GET /cases/{id}/report.pdf and /cases/{id}/transactions.csv; the brief supports ?format=pdf.
    toast({ tone: "success", title: "Export started", body: `${items.find((i) => i.id === id)?.title} for ${detail.id}. We’ll let you know when it’s ready.` });
  };
  return (
    <Menu
      label={`Export ${detail.id}`}
      width={380}
      trigger={(t) => (
        <Button variant="secondary" size="sm" onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu" iconLeft={<Icon name="app/icon-download-18" size={16} />}>
          Export
        </Button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Export {detail.id}</MenuLabel>
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
          <p className="flex items-start gap-2 border-t border-border-subtle px-2.5 pt-2.5 pb-1 text-caption text-text-secondary">
            <Icon name="icon-lock-secondary-16" size={14} className="mt-0.5" />
            Numbers stay masked. Every export is logged with your name.
          </p>
        </>
      )}
    </Menu>
  );
}
