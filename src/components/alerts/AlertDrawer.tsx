"use client";

import { Tabs } from "@/components/app/Card";
import { SeverityBadge } from "@/components/app/indicators";
import { useShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api/client";
import {
  patchAlert,
  useAlert,
  useAlertTransactions,
  useSubscriber,
  useSubscriberActivity,
  type Alert,
  type Person,
} from "@/lib/api/fd";
import { formatAgo, formatClock, formatMoney } from "@/lib/time";
import Link from "next/link";
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

/** B4–B7, B13, B20 · Alert drawer: story, activity, transactions, KYC & SIM, and the triage actions. */
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
  const [lockedBy, setLockedBy] = useState<{ by: Person; since?: string } | null>(null);
  const [attaching, setAttaching] = useState(false);

  const open = alert.status === "new" || alert.status === "seen" || alert.status === "locked";

  // Opening an open alert claims it for 10 minutes so two analysts don’t act on it at once (423 if taken).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiFetch("POST", `/alerts/${alert.id}/lock`).catch((err) => {
      if (cancelled || !(err instanceof ApiError) || err.status !== 423) return;
      setLockedBy({ by: err.problem.locked_by as Person, since: err.problem.since as string | undefined });
    });
    return () => {
      cancelled = true;
    };
  }, [alert.id, open]);

  const related = relatedAlerts(alert, all);
  const newRecipients = new Set(
    transactions?.data.filter((t) => t.counterparty_note.startsWith("New")).map((t) => t.counterparty),
  );
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
      await apiFetch("POST", `/alerts/${alert.id}/attach`, { case_id: suggestion.id });
      await attach(suggestion.id);
    } finally {
      setAttaching(false);
    }
  };

  const takeOver = async () => {
    // TODO(api): the collection has no way to take over a lock; proposed `take_over: true`.
    await apiFetch("POST", `/alerts/${alert.id}/lock`, { take_over: true }).catch(() => undefined);
    setLockedBy(null);
  };

  const money = detail?.money_out;
  const windowMin = transactions?.totals.window_minutes;
  const tabs = (
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
  );

  const first = lockedBy?.by.name.split(" ")[0];

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width={locked ? 560 : 640}
        badges={
          <>
            <SeverityBadge severity={alert.severity} size="md" />
            {status && <Badge label={status.label} tone={status.tone} size="md" dot={alert.status === "new"} />}
            <span className="font-mono text-mono-s text-text-tertiary">
              {alert.id} · {formatClock(alert.created_at)} today
            </span>
          </>
        }
        title={alert.title}
        subtitle={[alert.subscriber.msisdn, alert.region, subscriber && `Tier ${subscriber.wallet.tier} MoMo wallet`]
          .filter(Boolean)
          .join(" · ")}
        headerActions={
          !locked && (
            <Link
              href={`/subscribers/${alert.subscriber.subscriber_id}`}
              aria-label="Open subscriber profile"
              className="flex size-10 items-center justify-center rounded-[10px] border border-border-default bg-surface-base hover:bg-surface-raised"
            >
              <Icon name="app/icon-external-20" size={20} />
            </Link>
          )
        }
        tabs={tabs}
        footer={
          locked ? (
            <>
              {/* TODO(api): no messaging endpoint yet. */}
              <Button variant="secondary" size="md" disabled title="Messaging colleagues isn’t available yet" iconLeft={<Icon name="app/icon-message-18" size={18} />}>
                Ask {first}
              </Button>
              <span className="flex-1" />
              <Button variant="secondary" size="md" onClick={takeOver}>
                Take over
              </Button>
              <Button size="md" disabled iconLeft={<Icon name="app/icon-plus-primary-18" size={18} />}>
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
                <ButtonLink href={`/cases/${alert.case_id}`} size="md" iconRight={<Icon name="app/icon-arrow-right-white-16" size={16} />}>
                  Open {alert.case_id}
                </ButtonLink>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={() => setDialog("dismiss")} iconLeft={<Icon name="app/icon-x-primary-18" size={18} />}>
                Dismiss
              </Button>
              <span className="flex-1" />
              <Button variant="secondary" size="md" onClick={() => setDialog("attach")} iconLeft={<Icon name="app/icon-folder-primary-18" size={18} />}>
                Add to case
              </Button>
              <Menu
                label="Protect now"
                side="top"
                trigger={(t) => (
                  <Button
                    variant="danger-outline"
                    size="md"
                    onClick={t.toggle}
                    aria-expanded={t["aria-expanded"]}
                    aria-haspopup="menu"
                    iconLeft={<Icon name="app/icon-shield-critical-18" size={18} />}
                    iconRight={<Icon name="app/icon-chevron-down-critical-18" size={18} />}
                  >
                    Protect now
                  </Button>
                )}
              >
                {(close) => (
                  <>
                    <MenuLabel>Stop the loss</MenuLabel>
                    {(["freeze_wallet", "suspend_sim", "block_recipients"] as const).map((k) => (
                      <MenuItem
                        key={k}
                        icon={options[k].icon}
                        title={k === "block_recipients" && newRecipients.size ? `Block recipient wallets (${newRecipients.size})` : options[k].title}
                        description={options[k].menu}
                        onSelect={() => {
                          close();
                          openProtect(k);
                        }}
                      />
                    ))}
                    <MenuDivider />
                    <MenuItem
                      icon={options.send_safety_sms.icon}
                      title={options.send_safety_sms.title}
                      description={options.send_safety_sms.menu}
                      onSelect={() => {
                        close();
                        setDialog({ protect: ["send_safety_sms"] });
                      }}
                    />
                  </>
                )}
              </Menu>
              <Button
                variant={tab === "summary" && suggestion ? "secondary" : "primary"}
                size="md"
                onClick={() => setDialog("promote")}
                iconLeft={<Icon name={tab === "summary" && suggestion ? "app/icon-plus-primary-18" : "app/icon-plus-white-18"} size={18} />}
              >
                Open a case
              </Button>
            </>
          )
        }
      >
        {tab === "summary" && (
          <>
            {lockedBy && (
              <div className="flex items-start gap-3 rounded-[10px] border border-medium-border bg-medium-bg px-3.5 py-3">
                <Avatar initials={lockedBy.by.initials} />
                <div className="flex flex-col gap-0.5">
                  <p className="text-label-m text-medium-fg">{lockedBy.by.name} is triaging this alert</p>
                  <p className="text-body-s text-text-primary">
                    {lockedBy.since ? `Opened ${formatAgo(lockedBy.since, now)} · ` : ""}actions are locked so you don’t both act on it
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Glance label="Risk" value={`${alert.risk_score} / 100`} tone={alert.risk_score >= 70 ? "critical" : "medium"} />
              <Glance
                label="Money out"
                value={money ? `${formatMoney(money.amount_minor, money.currency)}${windowMin ? ` · ${windowMin} min` : ""}` : "None yet"}
                tone={money ? "high" : "neutral"}
              />
              <Glance
                label="Looks like"
                value={alert.case_id ? `In ${alert.case_id}` : suggestion ? `Part of ${suggestion.id}` : "A new pattern"}
                tone={suggestion || alert.case_id ? "brand" : "neutral"}
              />
            </div>
            {detail ? (
              <>
                {detail.what_happened.length > 0 && <WhatHappened steps={detail.what_happened} now={now} />}
                <RulesRow rules={detail.rules_fired} />
                {suggestion && open && (
                  <Recommendation
                    suggestion={suggestion}
                    busy={attaching}
                    locked={locked}
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

      {dialog === "dismiss" && (
        <DismissModal
          alert={alert}
          open
          onClose={() => setDialog(null)}
          onDone={(reason, feedback) => {
            patchAlert(alert.id, { status: "dismissed" });
            setDialog(null);
            onClose();
            toast({
              tone: "success",
              title: "Alert dismissed",
              body: `${alert.id} · reason: ${dismissReasonLabel(reason)}.${feedback ? ` Feedback sent to ${alert.rule_ids[0]}.` : ""}`,
              action: {
                label: "Undo",
                onClick: () => {
                  patchAlert(alert.id, null);
                  // TODO(api): proposed POST /alerts/{id}/undo-dismiss (10 s window).
                  void apiFetch("POST", `/alerts/${alert.id}/undo-dismiss`).catch(() => undefined);
                },
              },
            });
          }}
        />
      )}
      {dialog === "promote" && (
        <PromoteModal
          alert={alert}
          open
          related={related}
          me={user ? { name: user.name, shift: user.shift } : null}
          onClose={() => setDialog(null)}
          onDone={(caseId, linked) => {
            patchAlert(alert.id, { status: "promoted", case_id: caseId });
            related.slice(0, linked).forEach((a) => patchAlert(a.id, { status: "attached", case_id: caseId }));
            setDialog(null);
            onClose();
            toast({
              tone: "success",
              title: `Case ${caseId} opened and assigned to you`,
              body: linked ? `${alert.id} and ${linked} earlier ${linked === 1 ? "alert is" : "alerts are"} linked.` : `${alert.id} is linked.`,
              action: { label: "Open case", onClick: () => router.push(`/cases/${caseId}`) },
            });
          }}
        />
      )}
      {dialog === "attach" && (
        <AttachModal
          alert={alert}
          open
          onClose={() => setDialog(null)}
          onDone={(caseId) => {
            setDialog(null);
            void attach(caseId);
          }}
        />
      )}
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
