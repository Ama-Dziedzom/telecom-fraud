"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, useShell } from "@/components/app/AppShell";
import { Skeleton, Tabs } from "@/components/app/Card";
import { ActionBanner, EscalationBanner, ExportMenu, HandoverBanner, ReversalCard, ReversalResults, escalationAnswer, useActionRetry } from "@/components/case/CaseBanners";
import { CaseDialogs, type CaseDialog } from "@/components/case/CaseDialogs";
import { CaseNav, CaseTitle, StageBar, StartBanner } from "@/components/case/CaseHeader";
import { CaseProblem } from "@/components/case/CaseProblem";
import { EvidenceTab } from "@/components/case/EvidenceTab";
import { LinkedAlertsTab } from "@/components/case/LinkedAlertsTab";
import { NetworkTab } from "@/components/case/NetworkTab";
import { partLabel } from "@/components/case/ProtectDialogs";
import { FeedbackThanks, RejectedBanner, RejectedSummary, ResolutionCard, SentBackBanner, SignoffBanner } from "@/components/case/ResolutionViews";
import { DoThisNext, OtherActions, WhatHappened, WhoInvolved } from "@/components/case/SummaryTab";
import { TimelineTab } from "@/components/case/TimelineTab";
import { TransactionsTab } from "@/components/case/TransactionsTab";
import { BannerLink, firstName } from "@/components/case/parts";
import { SubscriberDrawer } from "@/components/subscriber/SubscriberDrawer";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useCase, type CaseDetail, type CaseStarted, type NextStepKind } from "@/lib/api/cases";
import type { PersonRef } from "@/lib/api/fd";
import { formatClock, useNow } from "@/lib/time";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";

type Tab = "summary" | "alerts" | "timeline" | "transactions" | "evidence" | "network";
const TABS: Tab[] = ["summary", "alerts", "timeline", "transactions", "evidence", "network"];

/** Banners that have their own component (start, sign-off, sent back) instead of the generic one. */
const BANNERS_ELSEWHERE = ["new", "pending_decision", "sent_back"];
const BANNER_TONE: Record<string, "success" | "warning" | "info"> = { protected: "success", reopened: "warning" };

/** C1–C10 (and the D/E actions) · Case workspace */
export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const caseId = decodeURIComponent(id).toUpperCase();
  const now = useNow();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { user } = useShell();
  const { mutate } = useSWRConfig();
  const { data: detail, error, isLoading } = useCase(caseId);
  const retry = useActionRetry(detail);
  const [starting, setStarting] = useState(false);
  const [subscriberOpen, setSubscriberOpen] = useState(false);
  // Arriving from a subscriber or a check with “Protect now” opens the protect dialog;
  // a cases-list row action (G35) opens its dialog with `?action=`.
  const [dialog, setDialog] = useState<CaseDialog | null>(() => {
    if (params.get("protect") === "1") return { kind: "protect", parts: ["freeze_wallet", "suspend_sim", "block_recipients"] };
    const action = params.get("action");
    if (action === "handover" || action === "escalate") return { kind: action };
    if (action === "false_positive") return { kind: "resolve", outcome: "false_positive" };
    return null;
  });

  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "summary") as Tab;

  const setTab = (t: Tab) => router.replace(`${pathname}${t === "summary" ? "" : `?tab=${t}`}`, { scroll: false });

  // D13 · say so when a supervisor answers while you’re on the case (once per answer).
  const answered = detail?.escalation && detail.escalation.status !== "waiting" ? detail.escalation : null;
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!answered || announced.current === answered.id) return;
    announced.current = answered.id;
    toast({
      title: `${answered.to.name.split(" ")[0]} answered your escalation`,
      body: `${caseId} · ${escalationAnswer(answered.status)}: ${answered.answer ?? "see the answer on the case"}`,
      action: {
        label: "View",
        onClick: () => {
          setTab("summary");
          document.getElementById("case-banners")?.scrollIntoView({ behavior: "smooth" });
        },
      },
    });
    // setTab only reads the current route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, caseId, toast]);

  if (error) return <CaseProblem caseId={caseId} error={error} />;

  /** Keep what an action answered with on the cached case (the mock would refetch the old state). */
  const patchCase = (patch: (c: CaseDetail) => Partial<CaseDetail>) =>
    mutate<CaseDetail>(`/cases/${caseId}`, (c) => (c ? { ...c, ...patch(c) } : c), { revalidate: false });

  const start = async () => {
    setStarting(true);
    try {
      const started = await apiFetch<CaseStarted>("POST", `/cases/${caseId}/start`);
      const { first_response: fr, ...change } = started;
      await patchCase((c) => ({ ...change, glance: { ...c.glance, first_response: fr } }));
      await mutate(`/cases/${caseId}/timeline`);
      toast({
        tone: "success",
        title: `You’re on it: ${caseId} is now Investigating`,
        body: `First response in ${fr.minutes} minutes · SLA ${fr.met ? "met" : "missed"}.`,
      });
    } catch (err) {
      toast({ title: "Couldn’t start the case", body: err instanceof ApiError ? err.problem.title : "Try again." });
    } finally {
      setStarting(false);
    }
  };

  const returnToQueue = async () => {
    await apiFetch("POST", `/cases/${caseId}/assign`, { user_id: null, note: "Not mine" }).catch(() => undefined);
    toast({ title: `${caseId} is back in the team queue` });
    router.push("/queue");
  };

  const pickUp = async () => {
    setStarting(true);
    try {
      await apiFetch("POST", "/cases/pick-up", { case_ids: [caseId] });
      const me: PersonRef | null = user ? { id: user.id, name: user.name, initials: user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() } : null;
      await patchCase(() => ({ assignee: me }));
      toast({ tone: "success", title: `${caseId} is yours`, body: "Start investigating when you’re ready." });
    } catch (err) {
      toast({ title: "Couldn’t pick up the case", body: err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : "Try again." });
    } finally {
      setStarting(false);
    }
  };

  const remind = async () => {
    try {
      const r = await apiFetch<{ reminded: PersonRef; next_allowed_at: string }>("POST", `/cases/${caseId}/resolution/remind`);
      toast({ tone: "success", title: `Reminder sent to ${r.reminded.name.split(" ")[0]}`, body: `You can send another at ${formatClock(r.next_allowed_at)}.` });
    } catch (err) {
      toast({ title: "Couldn’t send a reminder", body: err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : "Try again." });
    }
  };

  const linkCase = async (other: string | undefined) => {
    if (!other) return setTab("network");
    await apiFetch("POST", `/cases/${caseId}/links`, { case_id: other }).catch(() => undefined);
    await mutate(`/cases/${caseId}`);
    toast({ tone: "success", title: `${other} linked to ${caseId}` });
  };

  const onStep = (kind: NextStepKind) => {
    if (kind === "freeze_wallet" || kind === "suspend_sim" || kind === "block_recipients") setDialog({ kind: "protect", parts: [kind] });
    else if (kind === "call_subscriber") setDialog({ kind: "call" });
    else if (kind === "request_reversal") setDialog({ kind: "reversal" });
    else if (kind === "report_agent" || kind === "agent_suspension") setDialog({ kind: "suspend_agent" });
    else if (kind === "add_evidence") setTab("evidence");
    else if (kind === "watch_repeat") setDialog({ kind: "monitor" });
    else if (kind === "start") void start();
    else if (kind === "pick_up") void pickUp();
    else if (kind === "wait") void remind();
    // The step names the case to link in its title (“Link FD-3050”).
    else if (kind === "link_case") void linkCase(detail?.next_steps.recommended?.title.match(/FD-\d+/)?.[0]);
  };

  const isNew = detail?.status === "new";
  const unassigned = Boolean(detail && !detail.assignee);
  const closed = detail?.status === "closed";
  const locked = detail?.status === "pending_decision";
  const sentBack = detail?.status === "sent_back";
  const escalated = detail?.escalation?.status === "waiting";
  // E9 · a case closed without fraud is just its resolution.
  const resolutionOnly = closed && detail?.resolution?.outcome !== "confirmed_fraud";
  // “4 wallets + 1 cash-out” → 4.
  const recipients = detail?.what_happened.find((s) => s.kind === "wallets_paid")?.label.match(/(\d+) wallets?/)?.[1];

  const protectItems = detail
    ? ([
        { kind: "freeze_wallet", icon: "app/icon-lock-secondary-18", title: "Freeze MoMo wallet", detail: "Blocks transfers and cash-outs." },
        { kind: "suspend_sim", icon: "app/icon-sim-18", title: "Suspend SIM", detail: "Blocks calls, SMS and USSD until re-verified at a branch." },
        { kind: "block_recipients", icon: "app/icon-ban-18", title: `Block recipient wallets${recipients ? ` (${recipients})` : ""}`, detail: "Adds the new recipients to the watchlist for 30 days." },
        {
          kind: "send_safety_sms",
          icon: "app/icon-message-18",
          title: "Send a safety SMS",
          detail: `To the ${detail.contact?.alt_msisdn ? "alternate" : "registered"} number: “Did you make these payments? Call 100.”`,
        },
      ] as const)
    : [];

  return (
    <>
      <AppHeader section="Cases" title={caseId} />
      <PageBody className="flex flex-1 flex-col gap-4 px-8 pt-6 pb-8">
        {!detail || isLoading ? (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-8 w-[520px]" />
            <Skeleton className="h-14 w-[420px]" />
            <Skeleton className="h-10 w-full" />
            <div className="flex gap-6">
              <Skeleton className="h-[420px] flex-1 rounded-lg" />
              <Skeleton className="h-[420px] w-[360px] rounded-lg" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <StageBar stage={detail.stage} status={detail.status} />
              <span className="flex-1" />
              <CaseNav caseId={caseId} before={<ExportMenu detail={detail} />} />
            </div>
            <div className="flex flex-col gap-5">
              <CaseTitle
                detail={detail}
                meId={user?.id}
                now={now}
                onOpenSubscriber={() => setSubscriberOpen(true)}
                actions={
                  isNew ? (
                    !unassigned && <BannerLink onClick={returnToQueue}>Not mine: return to queue</BannerLink>
                  ) : closed ? (
                    <Button variant="secondary" size="md" onClick={() => setDialog({ kind: "reopen" })}>
                      Reopen
                    </Button>
                  ) : (
                    <>
                      <Menu
                        label="Protect"
                        width={300}
                        trigger={(t) => (
                          <Button variant="danger-outline" size="md" disabled={locked} onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu">
                            Protect
                          </Button>
                        )}
                      >
                        {(close) => (
                          <>
                            {protectItems.map((p) => (
                              <MenuItem
                                key={p.kind}
                                icon={p.icon}
                                title={p.title}
                                description={p.detail}
                                onSelect={() => {
                                  close();
                                  setDialog({ kind: "protect", parts: [p.kind] });
                                }}
                              />
                            ))}
                            <MenuDivider />
                            <MenuItem
                              icon="app/icon-sim-18"
                              title="Bar all SIMs on this Ghana Card"
                              description="For SIM farms registered to one ID."
                              onSelect={() => {
                                close();
                                setDialog({ kind: "bar_sims" });
                              }}
                            />
                          </>
                        )}
                      </Menu>
                      {locked || escalated ? (
                        <Tooltip title={escalated ? "Waiting on your escalation" : "Waiting for sign-off"} placement="top-end">
                          <Button variant="secondary" size="md" disabled>
                            Resolve
                          </Button>
                        </Tooltip>
                      ) : (
                        <Button variant="secondary" size="md" onClick={() => setDialog({ kind: sentBack ? "resubmit" : "resolve" })}>
                          Resolve
                        </Button>
                      )}
                    </>
                  )
                }
              />
              <Tabs
                label="Case sections"
                surface="canvas"
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "summary", label: "Summary" },
                  { id: "alerts", label: "Linked alerts", count: detail.counts?.linked_alerts },
                  { id: "timeline", label: "Timeline", count: detail.counts?.timeline },
                  { id: "transactions", label: "Transactions", count: detail.counts?.transactions },
                  { id: "evidence", label: "Evidence", count: detail.counts?.evidence },
                  { id: "network", label: "Network" },
                ]}
              />
            </div>

            {tab === "summary" && (
              <>
                <div id="case-banners" className="flex flex-col gap-3 empty:hidden">
                  {isNew && <StartBanner detail={detail} onStart={unassigned ? pickUp : start} busy={starting} />}
                  <RejectedBanner detail={detail} />
                  <SignoffBanner detail={detail} />
                  <SentBackBanner detail={detail} />
                  {!locked && !closed && <ActionBanner retry={retry} />}
                  <EscalationBanner detail={detail} />
                  <HandoverBanner detail={detail} />
                  <FeedbackThanks detail={detail} />
                  {detail.banners
                    .filter((b) => (b.kind === "read_only" ? !locked && !closed : !locked && !closed && !sentBack && !BANNERS_ELSEWHERE.includes(b.kind)))
                    .filter((b) => b.kind !== "protected" || detail.latest_action?.status !== "partial")
                    .map((b) => {
                      // The protected banner names no one: it is whoever asked for the action.
                      const by = b.by ?? (b.kind === "protected" ? detail.latest_action?.requested_by : undefined);
                      // Some titles carry the time already (“Reopened at 08:41”).
                      const time = b.at && !b.title.includes(formatClock(b.at)) ? ` · ${formatClock(b.at)}` : "";
                      return (
                        <Banner key={b.kind + (b.at ?? "")} tone={BANNER_TONE[b.kind] ?? "info"} title={`${b.title}${time}${time && by?.id === user?.id ? " by you" : ""}`}>
                          {b.detail}
                        </Banner>
                      );
                    })}
                </div>
                <ResolutionCard detail={detail} now={now} />
                {detail.reversal && !closed && <ReversalCard id={detail.reversal.id} subject={firstName(detail.subject.name)} />}
                {!resolutionOnly && (
                  <div className="flex items-start gap-6">
                    <div className="flex min-w-0 flex-1 flex-col gap-6">
                      {detail.rejection ? (
                        <RejectedSummary detail={detail} />
                      ) : (
                        <>
                          <WhatHappened detail={detail} />
                          <WhoInvolved detail={detail} onOpenNetwork={() => setTab("network")} />
                        </>
                      )}
                    </div>
                    <div className="flex w-[360px] shrink-0 flex-col gap-6">
                      {!(closed && detail.monitoring) && (
                        <DoThisNext
                          detail={detail}
                          onStep={onStep}
                          // C1 · a new case can act straight away; only sign-off and closed lock the steps.
                          locked={locked || closed}
                          retry={
                            retry && !locked && !closed
                              ? {
                                  title: partLabel(retry.failed, "waiting"),
                                  detail: `Failed ${formatClock(retry.failed.at ?? retry.action.requested_at)} · retrying in 2 min`,
                                  busy: retry.retrying,
                                  run: retry.retry,
                                }
                              : null
                          }
                        />
                      )}
                      <OtherActions
                        onNote={() => setTab("timeline")}
                        onEscalate={() => setDialog({ kind: "escalate" })}
                        onHandover={() => setDialog({ kind: "handover" })}
                        escalated={escalated}
                        readOnly={locked || closed}
                        supervisor={detail.escalation?.status === "waiting" ? detail.escalation.to.name : undefined}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === "alerts" && <LinkedAlertsTab caseId={caseId} meId={user?.id} now={now} />}
            {tab === "timeline" && <TimelineTab caseId={caseId} now={now} />}
            {tab === "transactions" && detail.reversal && <ReversalResults id={detail.reversal.id} />}
            {tab === "transactions" && (
              <TransactionsTab caseId={caseId} now={now} onRequestReversal={(txs) => setDialog({ kind: "reversal", transactions: txs })} onOpenEvidence={() => setTab("evidence")} />
            )}
            {tab === "evidence" && <EvidenceTab caseId={caseId} />}
            {tab === "network" && (
              <NetworkTab
                caseId={caseId}
                seed={detail.subject.subscriber_id}
                subject={detail.subject.msisdn}
                moneyOut={detail.glance.money}
                since={detail.what_happened.find((s) => s.kind === "sim_swap")?.at}
                onBlock={(node) => setDialog({ kind: "protect", parts: ["block_recipients"], targets: [node.id] })}
              />
            )}
          </>
        )}
      </PageBody>

      {detail && subscriberOpen && (
        <SubscriberDrawer
          subscriberId={detail.subject.subscriber_id}
          now={now}
          onClose={() => setSubscriberOpen(false)}
          onLogCall={() => {
            setSubscriberOpen(false);
            setDialog({ kind: "call" });
          }}
        />
      )}
      {detail && dialog && <CaseDialogs detail={detail} dialog={dialog} onClose={() => setDialog(null)} onOpen={setDialog} />}
    </>
  );
}
