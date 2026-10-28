"use client";

import { Tabs } from "@/components/app/Card";
import { SeverityBadge } from "@/components/app/indicators";
import { useShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch, isProblem } from "@/lib/api/client";
import {
  patchAlert,
  useAlert,
  useAlertTransactions,
  useSubscriber,
  useSubscriberActivity,
  type Alert,
  type PersonRef,
} from "@/lib/api/fd";
import { formatAgo, formatMoney } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityTab, Glance, KycTab, Recommendation, RulesRow, TransactionsTab, WhatHappened } from "./AlertTabs";
import {
  AttachModal,
  DismissModal,
  PromoteModal,
  ProtectModal,
  dismissReasonLabel,
  protectOptions,
  relatedAlerts,
  type ProtectKind,
} from "./TriageModals";

type Tab = "summary" | "activity" | "transactions" | "kyc";
type Dialog = null | "dismiss" | "promote" | "attach" | { protect: ProtectKind[] };

const STATUS_BADGE: Partial<Record<Alert["status"], { label: string; tone: "info" | "neutral" }>> = {
  new: { label: "New", tone: "info" },
  seen: { label: "Seen", tone: "neutral" },
  locked: { label: "Being triaged", tone: "neutral" },
};

const SEVERITY_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;

/** The first clause of engine text (“Same mule wallet, same pattern…” → “Same mule wallet”). */
const firstClause = (text: string) => text.split(/[,.;]/)[0].trim();

/** B4–B7, B13, B20 · Alert drawer: summary, activity, transactions, KYC & SIM, and the triage actions. */
export function AlertDrawer({
  alert,
  all,
  now,
  onClose,
  initialDialog = null,
}: {
  alert: Alert;
  all: Alert[];
  now: number;
  onClose: () => void;
  /** Open straight into an action (from the row’s ⋯ menu). */
  initialDialog?: "dismiss" | "promote" | "attach" | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useShell();
  const { data: detail } = useAlert(alert.id);
  const { data: subscriber } = useSubscriber(alert.subscriber.subscriber_id);
  const { data: activity } = useSubscriberActivity(alert.subscriber.subscriber_id);
  const { data: transactions } = useAlertTransactions(alert.id);
  const [tab, setTab] = useState<Tab>("summary");
  const [dialog, setDialog] = useState<Dialog>(initialDialog);
  const [lockedBy, setLockedBy] = useState<{ by: PersonRef; since?: string } | null>(null);
  const [attaching, setAttaching] = useState(false);

  const open = alert.status === "new" || alert.status === "seen" || alert.status === "locked";

  // Opening an open alert claims it for 10 minutes so two analysts don’t act on it at once (423 if taken).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiFetch("POST", `/alerts/${alert.id}/lock`).catch((err) => {
      if (cancelled || !isProblem(err, "locked")) return;
      setLockedBy({ by: err.problem.locked_by as PersonRef, since: err.problem.since as string | undefined });
    });
    return () => {
      cancelled = true;
    };
  }, [alert.id, open]);

  const related = relatedAlerts(alert, all);
  const newRecipients = new Set(transactions?.data.filter((t) => t.counterparty_new).map((t) => t.counterparty));
  const options = protectOptions(detail, subscriber, newRecipients.size);
  const suggestion = detail?.suggested_case ?? null;
  const locked = Boolean(lockedBy);
  const status = STATUS_BADGE[alert.status];

  const openProtect = (kind: ProtectKind) => {
    const recommended = (Object.keys(options) as ProtectKind[]).filter((k) => options[k].recommended && k !== "send_safety_sms");
    setDialog({ protect: Array.from(new Set([kind, ...recommended])) });
  };

  const attach = async (caseId: string) => {
    patchAlert(alert.id, { status: "attached", case_id: caseId });
    onClose();
    toast({
      tone: "success",
      title: `Added to ${caseId}`,
      body: `${alert.id} is linked to the case.`,
      action: { label: "Open case", onClick: () => router.push(`/cases/${caseId}`) },
    });
  };

  const attachSuggested = async () => {
    if (!suggestion) return;
    setAttaching(true);
    try {
      await apiFetch("POST", `/alerts/${alert.id}/attach`, { case_id: suggestion.case_id });
      await attach(suggestion.case_id);
    } finally {
      setAttaching(false);
    }
  };

  const takeOver = async () => {
    try {
      await apiFetch("POST", `/alerts/${alert.id}/lock`, { take_over: true });
      setLockedBy(null);
    } catch (err) {
      toast({ title: "Couldn’t take over", body: err instanceof ApiError ? err.message : "Try again in a moment." });
    }
  };

  const money = alert.money_out;
  const windowMin = transactions?.totals.window_minutes;
  const caseId = alert.case_id ?? suggestion?.case_id;
  const first = lockedBy?.by.name.split(" ")[0];

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width={560}
        badges={
          <>
            <SeverityBadge severity={alert.severity} size="md" />
            {status && <Badge label={status.label} tone={status.tone} size="md" />}
          </>
        }
        title={alert.title}
        subtitle={[alert.id, alert.subscriber.msisdn, alert.region, subscriber && `Tier ${subscriber.wallet.tier} MoMo wallet`]
          .filter(Boolean)
          .join(" · ")}
        tabs={
          <Tabs
            label="Alert details"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "summary", label: "Summary" },
              { id: "activity", label: "Activity", count: activity?.data.length },
              { id: "transactions", label: "Transactions", count: transactions?.totals.total },
              { id: "kyc", label: "KYC & SIM" },
            ]}
          />
        }
        footer={
          locked ? (
            // B20 · Alert already being triaged
            <>
              {/* TODO(api): no messaging endpoint yet. */}
              <Button variant="ghost" size="md" disabled title="Messaging colleagues isn’t available yet">
                Ask {first}
              </Button>
              <span className="flex-1" />
              <Button variant="secondary" size="md" onClick={takeOver}>
                Take over
              </Button>
              <Button size="md" disabled>
                Open a case
              </Button>
            </>
          ) : !open ? (
            <>
              <span className="text-body-s text-text-secondary">
                {alert.status === "dismissed" ? "Dismissed" : alert.case_id ? `Linked to ${alert.case_id}` : "Triaged"}
              </span>
              <span className="flex-1" />
              {alert.case_id && (
                <ButtonLink href={`/cases/${alert.case_id}`} size="md">
                  Open {alert.case_id}
                </ButtonLink>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={() => setDialog("dismiss")}>
                Dismiss
              </Button>
              <span className="flex-1" />
              {/* B13 · Protect options */}
              <Menu
                label="Protect"
                side="top"
                width={315}
                trigger={(t) => (
                  <Button variant="danger-outline" size="md" onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu">
                    Protect
                  </Button>
                )}
              >
                {(close) =>
                  (["freeze_wallet", "suspend_sim", "block_recipients", "send_safety_sms"] as const).map((k) => (
                    <MenuItem
                      key={k}
                      icon={options[k].icon}
                      title={options[k].menuTitle}
                      description={options[k].menu}
                      onSelect={() => {
                        close();
                        if (k === "send_safety_sms") setDialog({ protect: ["send_safety_sms"] });
                        else openProtect(k);
                      }}
                    />
                  ))
                }
              </Menu>
              <Button variant="secondary" size="md" onClick={() => setDialog("attach")}>
                Add to case
              </Button>
              <Button size="md" onClick={() => setDialog("promote")}>
                Open a case
              </Button>
            </>
          )
        }
      >
        {tab === "summary" && (
          <>
            {lockedBy && (
              <Banner tone="info" title={`${lockedBy.by.name} is triaging this alert`}>
                {lockedBy.since ? `Opened ${formatAgo(lockedBy.since, now)}. ` : ""}Actions are locked so you don’t both act on it.
              </Banner>
            )}
            <div className="flex gap-3">
              <Glance
                label="Risk"
                value={alert.risk_score}
                sub={[SEVERITY_LABEL[alert.severity], detail && `${detail.rules_fired.length} ${detail.rules_fired.length === 1 ? "rule" : "rules"}`]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Glance
                label="Money out"
                value={money ? formatMoney(money.amount_minor, money.currency) : "None yet"}
                sub={money && windowMin ? `In ${windowMin} min` : undefined}
              />
              <Glance
                label="Looks like"
                value={caseId ?? "New"}
                brand={Boolean(caseId)}
                sub={alert.case_id ? "Already linked" : suggestion ? firstClause(suggestion.why) : "No similar case yet"}
              />
            </div>
            {detail ? (
              <>
                {detail.what_happened.length > 0 && <WhatHappened steps={detail.what_happened} moneyOut={alert.money_out} now={now} />}
                <RulesRow rules={detail.rules_fired} />
                {suggestion && open && !locked && (
                  <Recommendation
                    suggestion={suggestion}
                    busy={attaching}
                    onAttach={attachSuggested}
                    onProtect={() => openProtect("freeze_wallet")}
                  />
                )}
              </>
            ) : (
              <p className="text-body-s text-text-secondary">Loading what happened…</p>
            )}
          </>
        )}
        {tab === "activity" && <ActivityTab subscriberId={alert.subscriber.subscriber_id} now={now} />}
        {tab === "transactions" && <TransactionsTab alertId={alert.id} />}
        {tab === "kyc" && <KycTab subscriberId={alert.subscriber.subscriber_id} now={now} />}
      </Drawer>

      {/* B8 · Dismiss needs a reason → B9 · undo for 10 s */}
      {dialog === "dismiss" && (
        <DismissModal
          alert={alert}
          rules={detail?.rules_fired}
          open
          onClose={() => setDialog(null)}
          onDone={(reason, feedback) => {
            patchAlert(alert.id, { status: "dismissed" });
            setDialog(null);
            onClose();
            toast({
              tone: "success",
              title: "Alert dismissed",
              body: [alert.id, dismissReasonLabel(reason), feedback && `feedback sent to ${alert.rule_ids[0]}`].filter(Boolean).join(" · "),
              action: {
                label: "Undo",
                onClick: () => {
                  patchAlert(alert.id, null);
                  // Allowed until the dismissal’s `undo_until` (10 s); later the server answers 409.
                  void apiFetch("POST", `/alerts/${alert.id}/undo-dismiss`).catch((err) => {
                    patchAlert(alert.id, { status: "dismissed" });
                    if (err instanceof ApiError && err.status === 409) toast({ title: "Too late to undo", body: `${alert.id} stays dismissed.` });
                  });
                },
              },
            });
          }}
        />
      )}
      {/* B10 · Open a case → B11 · Case created */}
      {dialog === "promote" && (
        <PromoteModal
          alert={alert}
          open
          related={related}
          me={user ? { name: user.name, shift: user.shift } : null}
          onClose={() => setDialog(null)}
          onDone={(created, linked) => {
            patchAlert(alert.id, { status: "promoted", case_id: created });
            related.slice(0, linked).forEach((a) => patchAlert(a.id, { status: "attached", case_id: created }));
            setDialog(null);
            onClose();
            toast({
              tone: "success",
              title: `Case ${created} opened and assigned to you`,
              body: linked ? `${alert.id} and ${linked} earlier ${linked === 1 ? "alert" : "alerts"} are linked` : `${alert.id} is linked`,
              action: { label: "Open case", onClick: () => router.push(`/cases/${created}`) },
            });
          }}
        />
      )}
      {/* B12 · Add to an existing case */}
      {dialog === "attach" && (
        <AttachModal
          alert={alert}
          open
          onClose={() => setDialog(null)}
          onDone={(target) => {
            setDialog(null);
            void attach(target);
          }}
        />
      )}
      {/* B14 · Protect confirm */}
      {dialog && typeof dialog === "object" && (
        <ProtectModal
          alert={alert}
          open
          initial={dialog.protect}
          options={options}
          recipients={Array.from(newRecipients)}
          relatedCount={related.length}
          onClose={() => setDialog(null)}
          onDone={({ case: created, action }) => {
            patchAlert(alert.id, { status: "promoted", case_id: created.id });
            setDialog(null);
            onClose();
            toast({
              tone: "success",
              title: `Case ${created.id} opened · protection applying`,
              body: `${action.parts.length} ${action.parts.length === 1 ? "action is" : "actions are"} being applied. You’ll see each result on the case.`,
              action: { label: "Open case", onClick: () => router.push(`/cases/${created.id}`) },
            });
          }}
        />
      )}
    </>
  );
}
