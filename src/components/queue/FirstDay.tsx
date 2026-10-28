"use client";

import { Card } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import type { ReactNode } from "react";

/** A3 · First day · empty queue — “Needs you now” with the first-run empty state. */
export function FirstDay({ supervisor, shiftStart, action }: { supervisor?: string; shiftStart?: string; action: ReactNode }) {
  const detail = [
    supervisor ? `${supervisor} assigns your first cases` : "Your supervisor assigns your first cases",
    shiftStart && `shift started ${shiftStart}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card title="Needs you now">
      <EmptyState bare icon="app/icon-inbox-tertiary-18" title="No cases assigned to you yet" actions={action} className="py-8">
        {detail}
      </EmptyState>
    </Card>
  );
}
