"use client";

import { CheckLayout } from "@/components/subscriber/CheckLayout";
import { DEFAULT_PATTERNS_QUERY, PatternsView } from "@/components/subscriber/PatternsView";
import { useSubscriber } from "@/lib/api/fd";
import { usePatterns } from "@/lib/api/subscribers";
import { useParams } from "next/navigation";

/** C26 · Transaction patterns (standalone; also the subscriber’s Transactions tab). */
export default function PatternsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sub } = useSubscriber(id);
  const { data, isLoading } = usePatterns(id, DEFAULT_PATTERNS_QUERY);

  return (
    <CheckLayout
      subscriberId={id}
      profileTab="transactions"
      section="Transaction patterns"
      title="Transaction patterns"
      status={data ? { label: `${data.findings.length} patterns found`, tone: data.findings.length ? "critical" : "success" } : undefined}
      subtitle={sub ? `${sub.name} · MoMo wallet · transfers out` : undefined}
      evidenceTitle="Transaction patterns"
      exportLabel="Export chart"
      loading={isLoading && !data}
    >
      <PatternsView id={id} />
    </CheckLayout>
  );
}
