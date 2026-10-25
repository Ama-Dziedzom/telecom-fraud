"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, useShell } from "@/components/app/AppShell";
import { Skeleton, Tabs } from "@/components/app/Card";
import { ActionBanner, EscalationBanner, ExportMenu, HandoverBanner, ReversalCard, ReversalResults } from "@/components/case/CaseBanners";
import { CaseDialogs, type CaseDialog } from "@/components/case/CaseDialogs";
import {
  CompactStrip,
  FeedbackThanks,
  RejectedBanner,
  RejectedSummary,
  ResolutionCard,
  SentBackBanner,
  SignoffBanner,
} from "@/components/case/ResolutionViews";
import { CaseNav, CaseTitle, GlanceTiles, StageBar, StartBanner } from "@/components/case/CaseHeader";
import { CaseProblem } from "@/components/case/CaseProblem";
import { EvidenceTab } from "@/components/case/EvidenceTab";
import { LinkedAlertsTab } from "@/components/case/LinkedAlertsTab";
import { NetworkTab } from "@/components/case/NetworkTab";
import { DoThisNext, StoryStrip, WhoInvolved } from "@/components/case/SummaryTab";
import { TimelineTab } from "@/components/case/TimelineTab";
import { TransactionsTab } from "@/components/case/TransactionsTab";
import { RevealModal } from "@/components/subscriber/RevealModal";
import { SubscriberDrawer } from "@/components/subscriber/SubscriberDrawer";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useCase, type CaseDetail, type NextStepKind } from "@/lib/api/cases";
import { formatClock, useNow } from "@/lib/time";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";

type Tab = "summary" | "alerts" | "timeline" | "transactions" | "evidence" | "network";
const TABS: Tab[] = ["summary", "alerts", "timeline", "transactions", "evidence", "network"];

const PROTECT_ITEMS = [
  { kind: "freeze_wallet", icon: "app/icon-wallet-18", title: "Freeze MoMo wallet", detail: "Blocks transfers and cash-outs." },
  { kind: "suspend_sim", icon: "app/icon-sim-18", title: "Suspend SIM", detail: "Blocks calls, SMS and USSD until re-verified in branch." },
  { kind: "block_recipients", icon: "app/icon-ban-18", title: "Block recipient wallets", detail: "Adds the new recipients to the watchlist for 30 days." },
] as const;

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
  const [starting, setStarting] = useState(false);
  const [subscriberOpen, setSubscriberOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  // Arriving from a subscriber or a check with “Protect now” opens the protect dialog.
  const [dialog, setDialog] = useState<CaseDialog | null>(() =>
    params.get("protect") === "1" ? { kind: "protect", parts: ["freeze_wallet"] } : null,
  );

  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "summary") as Tab;

  const setTab = (t: Tab) => router.replace(`${pathname}${t === "summary" ? "" : `?tab=${t}`}`, { scroll: false });

  // D13 · say so when a supervisor answers while you’re on the case (once per answer).
  const answered = detail?.escalation?.status === "answered" ? detail.escalation : null;
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!answered || announced.current === answered.id) return;
    announced.current = answered.id;
    toast({
      title: `${answered.to.name.split(" ")[0]} answered your escalation`,
      body: `${caseId} · ${answered.answer?.label.replace(/^Approved: /, "") ?? "see the answer on the case"}`,
      action: { label: "View", onClick: () => document.getElementById("case-banners")?.scrollIntoView({ behavior: "smooth" }) },
    });
  }, [answered, caseId, toast]);

  if (error) return <CaseProblem caseId={caseId} error={error} />;

  const start = async () => {
    setStarting(true);
    try {
      // TODO(api): proposed POST /cases/{id}/start (New → Investigating).
      const updated = await apiFetch<CaseDetail>("POST", `/cases/${caseId}/start`);
      await mutate(`/cases/${caseId}`, updated, { revalidate: false });
      await mutate(`/cases/${caseId}/timeline`);
      const fr = updated.glance.first_response;
      toast({
        tone: "success",
        title: `You’re on it: ${caseId} is now Investigating`,
        body: fr.minutes !== null ? `First response in ${fr.minutes} minutes · SLA ${fr.met ? "met" : "missed"}.` : undefined,
      });
    } catch (err) {
      toast({ title: "Couldn’t start the case", body: err instanceof ApiError ? err.problem.title : "Try again." });
    } finally {
      setStarting(false);
    }
  };

  const returnToQueue = async () => {
    // TODO(api): POST /cases/{id}/assign needs a user; proposed `user_id: null` for the team queue.
    await apiFetch("POST", `/cases/${caseId}/assign`, { user_id: null, note: "Not mine" }).catch(() => undefined);
    toast({ title: `${caseId} is back in the team queue` });
    router.push("/queue");
  };

  const onStep = (kind: NextStepKind) => {
    if (kind === "freeze_wallet" || kind === "suspend_sim" || kind === "block_recipients") setDialog({ kind: "protect", parts: [kind] });
    else if (kind === "call_subscriber") setDialog({ kind: "call" });
    else if (kind === "request_reversal") setDialog({ kind: "reversal" });
    else if (kind === "report_agent") setDialog({ kind: "suspend_agent" });
    else if (kind === "add_evidence") setTab("evidence");
    else if (kind === "watch_repeat") setDialog({ kind: "monitor" });
    else if (kind === "await_signoff")
      // TODO(api): proposed POST /cases/{id}/resolution/remind.
      toast({ tone: "success", title: `Reminder sent to ${detail?.resolution?.reviewer?.name.split(" ")[0] ?? "your supervisor"}` });
  };

  const isNew = detail?.status === "new";
  const closed = detail?.status === "closed";
  const locked = detail?.status === "pending_decision";
  const sentBack = detail?.status === "sent_back";
  const compact = Boolean(detail?.rejection) || (closed && detail?.resolution?.outcome !== "confirmed_fraud");
  const escalated = detail?.escalation?.status === "waiting";

  return (
    <>
      <AppHeader section="Cases" title={caseId} />
      <PageBody>
        {!detail || isLoading ? (
          <div className="flex flex-col gap-6" aria-busy>
            <Skeleton className="h-8 w-[420px]" />
            <Skeleton className="h-12 w-[520px]" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[122px] flex-1 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[220px] w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <StageBar stage={detail.stage} status={detail.status} />
              <div className="flex items-center gap-2">
                {!isNew && !closed && (
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "handover" })} iconLeft={<Icon name="app/icon-users-secondary-16" size={16} />}>
                    Hand over
                  </Button>
                )}
                <ExportMenu detail={detail} />
                <CaseNav caseId={caseId} />
              </div>
            </div>
            <CaseTitle
              detail={detail}
              meId={user?.id}
              onOpenSubscriber={() => setSubscriberOpen(true)}
              onReveal={() => setRevealOpen(true)}
              actions={
                isNew ? (
                  <>
                    <ButtonLink href={`/cases/${caseId}/story`} variant="secondary" size="md" iconLeft={<Icon name="app/icon-play-story-18" size={18} />}>
                      Play story
                    </ButtonLink>
                    <Button variant="ghost" size="md" onClick={returnToQueue}>
                      Not mine: return to queue
                    </Button>
                  </>
                ) : (
                  <>
                    <ButtonLink href={`/cases/${caseId}/story`} variant="secondary" size="md" iconLeft={<Icon name="app/icon-play-story-18" size={18} />}>
                      Play story
                    </ButtonLink>
                    {locked && (
                      <Button variant="secondary" size="md" onClick={() => setTab("timeline")} iconLeft={<Icon name="app/icon-message-18" size={18} />}>
                        Add note
                      </Button>
                    )}
                    {!closed && (
                      <>
                        {!locked && (
                          <Button variant="secondary" size="md" onClick={() => setDialog({ kind: "call" })} iconLeft={<Icon name="app/icon-phone-18" size={18} />}>
                            Log a call
                          </Button>
                        )}
                        {!escalated && !locked && (
                          <Button variant="secondary" size="md" onClick={() => setDialog({ kind: "escalate" })} iconLeft={<Icon name="app/icon-escalate-18" size={18} />}>
                            Escalate
                          </Button>
                        )}
                        <Menu
                          label="Protect"
                          trigger={(t) => (
                            <Button
                              variant="danger-outline"
                              size="md"
                              disabled={locked}
                              onClick={t.toggle}
                              aria-expanded={t["aria-expanded"]}
                              aria-haspopup="menu"
                              iconLeft={<Icon name="app/icon-shield-critical-18" size={18} />}
                              iconRight={<Icon name="app/icon-chevron-down-critical-18" size={18} />}
                            >
                              Protect
                            </Button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuLabel>Stop the loss</MenuLabel>
                              {PROTECT_ITEMS.map((p) => (
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
                                icon="app/icon-refresh-16"
                                title="Request reversal from MoMo ops"
                                description="Recall money still in recipient wallets."
                                onSelect={() => {
                                  close();
                                  setDialog({ kind: "reversal" });
                                }}
                              />
                              <MenuItem
                                icon="app/icon-sim-18"
                                title="Bar all SIMs on this Ghana Card"
                                description="For SIM farms registered to one ID."
                                onSelect={() => {
                                  close();
                                  setDialog({ kind: "bar_sims" });
                                }}
                              />
                              <MenuItem
                                icon="app/icon-ban-18"
                                title="Request an agent suspension"
                                description="For the agent who did the swap."
                                onSelect={() => {
                                  close();
                                  setDialog({ kind: "suspend_agent" });
                                }}
                              />
                            </>
                          )}
                        </Menu>
                      </>
                    )}
                    {closed ? (
                      <Button variant="secondary" size="md" onClick={() => setDialog({ kind: "reopen" })} iconLeft={<Icon name="app/icon-refresh-primary-18" size={18} />}>
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        size="md"
                        disabled={locked || escalated}
                        title={escalated ? "Waiting on your escalation" : locked ? "Waiting for sign-off" : undefined}
                        onClick={() => setDialog({ kind: sentBack ? "resubmit" : "resolve" })}
                        iconLeft={<Icon name="app/icon-check-white-18" size={18} />}
                      >
                        Resolve
                      </Button>
                    )}
                  </>
                )
              }
            />
            {isNew && <StartBanner detail={detail} onStart={start} busy={starting} />}
            <div id="case-banners" className="flex flex-col gap-3 empty:hidden">
              <RejectedBanner detail={detail} />
              <SignoffBanner detail={detail} />
              <SentBackBanner detail={detail} onEvidence={() => setTab("evidence")} />
              {!locked && !closed && <ActionBanner detail={detail} />}
              <EscalationBanner detail={detail} />
              <HandoverBanner detail={detail} />
              {!locked && !closed && !sentBack && detail.latest_action?.status !== "partial" &&
                detail.banners.map((b) => (
                  <Banner
                    key={b.kind + b.at}
                    tone={b.kind === "protected" ? "success" : b.kind === "sent_back" ? "warning" : "info"}
                    title={`${b.title}${b.at ? ` · ${formatClock(b.at)} by you` : ""}`}
                  >
                    {b.detail}
                  </Banner>
                ))}
            </div>
            {compact ? <CompactStrip detail={detail} now={now} /> : <GlanceTiles detail={detail} now={now} />}
            <Tabs
              label="Case sections"
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
            {tab === "summary" && detail.rejection && <RejectedSummary detail={detail} />}
            {tab === "summary" && compact && closed && (
              <>
                <FeedbackThanks detail={detail} />
                <ResolutionCard detail={detail} now={now} />
              </>
            )}
            {tab === "summary" && !compact && (
              <>
                <ResolutionCard detail={detail} now={now} />
                {detail.reversal && !closed && <ReversalCard id={detail.reversal.id} />}
                <StoryStrip steps={detail.what_happened} />
                <div className="flex items-stretch gap-4">
                  {!(closed && detail.monitoring) && <DoThisNext steps={detail.next_steps} onStep={onStep} locked={isNew || locked || closed} />}
                  <WhoInvolved detail={detail} onOpenNetwork={() => setTab("network")} />
                </div>
              </>
            )}
            {tab === "alerts" && <LinkedAlertsTab caseId={caseId} meId={user?.id} now={now} />}
            {tab === "timeline" && <TimelineTab caseId={caseId} now={now} />}
            {tab === "transactions" && detail.reversal && <ReversalResults id={detail.reversal.id} />}
            {tab === "transactions" && (
              <TransactionsTab caseId={caseId} now={now} onRequestReversal={(txs) => setDialog({ kind: "reversal", transactions: txs })} />
            )}
            {tab === "evidence" && <EvidenceTab caseId={caseId} />}
            {tab === "network" && (
              <NetworkTab caseId={caseId} seed={detail.subject.subscriber_id} onBlock={(node) => setDialog({ kind: "protect", parts: ["block_recipients"], targets: [node.id] })} />
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
      {detail && revealOpen && (
        <RevealModal
          open
          onClose={() => setRevealOpen(false)}
          subscriber={{ id: detail.subject.subscriber_id, name: detail.subject.name }}
          cases={[{ id: detail.id, title: detail.title }]}
        />
      )}
      {detail && dialog && <CaseDialogs detail={detail} dialog={dialog} onClose={() => setDialog(null)} onOpen={setDialog} />}
    </>
  );
}
