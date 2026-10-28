"use client";

import { CheckLayout } from "@/components/subscriber/CheckLayout";
import { BehaviourSkeleton, BehaviourView, SIGNALS } from "@/components/subscriber/BehaviourView";
import { localNumber } from "@/components/subscriber/ProfileParts";
import { useSubscriber } from "@/lib/api/fd";
import { useBehaviour } from "@/lib/api/subscribers";
import { useParams } from "next/navigation";

/** C19/C20 · Behaviour profile — normal vs now (standalone; also the subscriber’s Activity tab). */
export default function BehaviourPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sub } = useSubscriber(id);
  const { data, isLoading } = useBehaviour(id);
  const unusual = data ? SIGNALS.filter((s) => data.signals[s.key].unusual).length : 0;

  return (
    <CheckLayout
      subscriberId={id}
      profileTab="activity"
      section="Behaviour profile"
      title="Normal vs now"
      status={data ? { label: `${unusual} of ${SIGNALS.length} signals unusual`, tone: unusual ? "critical" : "success" } : undefined}
      subtitle={sub && data ? `${sub.name} · ${localNumber(sub.msisdn)} · compared with his last ${data.compared_days} days` : undefined}
      loadingSubtitle="building his 90-day profile"
      evidenceTitle="Behaviour profile: normal vs now"
      loading={isLoading || !data}
      skeleton={<BehaviourSkeleton />}
    >
      <BehaviourView id={id} />
    </CheckLayout>
  );
}
