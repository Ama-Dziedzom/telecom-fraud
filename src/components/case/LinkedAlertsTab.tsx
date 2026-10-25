"use client";

import { RequestError } from "@/components/auth/RequestError";
import { SeverityBadge, riskText } from "@/components/app/indicators";
import { Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useLinkedAlerts, type LinkedAlert } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen } from "@/lib/time";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";

function howLinked(a: LinkedAlert, meId?: string) {
  if (a.link?.kind === "opened") return { label: "Opened case", tone: "brand" as const };
  if (a.link?.kind === "auto") return { label: "Auto-linked", tone: "neutral" as const };
  const by = a.link?.by;
  return { label: by ? `Added by ${by.id === meId ? by.name.split(" ")[0] : by.name}` : "Added", tone: "neutral" as const };
}

/** C3 · Linked alerts — what joined the case and how; unlink or link another. */
export function LinkedAlertsTab({ caseId, meId, now }: { caseId: string; meId?: string; now: number }) {
  const { data, isLoading } = useLinkedAlerts(caseId);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [linking, setLinking] = useState(false);
  const [alertId, setAlertId] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [unlinked, setUnlinked] = useState<string[]>([]);

  const rows = (data?.data ?? []).filter((a) => !unlinked.includes(a.id));

  const unlink = async (a: LinkedAlert) => {
    // TODO(api): proposed DELETE /cases/{id}/linked-alerts/{alert_id}.
    await apiFetch("DELETE", `/cases/${caseId}/linked-alerts/${a.id}`).catch(() => undefined);
    setUnlinked((u) => [...u, a.id]);
    toast({
      tone: "success",
      title: `${a.id} unlinked`,
      body: "It’s back in Live alerts.",
      action: { label: "Undo", onClick: () => setUnlinked((u) => u.filter((x) => x !== a.id)) },
    });
  };

  const link = async () => {
    const id = alertId.trim().toUpperCase();
    setBusy(true);
    setFailure(null);
    try {
      await apiFetch("POST", `/alerts/${id}/attach`, { case_id: caseId });
      await mutate(`/cases/${caseId}/linked-alerts`);
      setLinking(false);
      setAlertId("");
      toast({ tone: "success", title: `${id} linked to ${caseId}` });
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
        <table className="w-full table-fixed text-left">
          <thead className="border-b border-border-subtle bg-surface-raised">
            <tr className="text-overline text-text-tertiary uppercase">
              <th className="w-[100px] py-[11px] pl-5 font-bold">Time</th>
              <th className="w-[166px] py-[11px] font-bold">Risk</th>
              <th className="py-[11px] font-bold">Signal</th>
              <th className="w-[130px] py-[11px] font-bold">Where</th>
              <th className="w-[200px] py-[11px] font-bold">How linked</th>
              <th className="w-[140px] py-[11px] pr-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-4">
                  <Skeleton className="h-8 w-full" />
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const how = howLinked(a, meId);
              return (
                <tr key={a.id} className="border-b border-border-subtle last:border-b-0">
                  <td className="py-3.5 pl-5">
                    <span className="flex flex-col text-caption">
                      <span className="font-mono text-mono-s text-text-primary">{formatClock(a.created_at)}</span>
                      <span className="text-text-tertiary">{formatWhen(a.created_at, now) === formatClock(a.created_at) ? "today" : formatWhen(a.created_at, now)}</span>
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className="flex items-center gap-2">
                      <span className={cn("text-label-m", riskText(a.risk_score))}>{a.risk_score}</span>
                      <SeverityBadge severity={a.severity} />
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="flex flex-col gap-0.5">
                      <span className="truncate text-label-m text-text-primary">{a.title}</span>
                      <span className="truncate font-mono text-mono-s text-text-tertiary">{[a.id, ...a.rule_ids].join(" · ")}</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-body-s text-text-secondary">{a.region}</td>
                  <td className="py-3.5">
                    <Badge label={how.label} tone={how.tone} />
                  </td>
                  <td className="py-3.5 pr-5">
                    <span className="flex justify-end gap-1">
                      <Link href={`/alerts?alert=${a.id}`} className="rounded-lg px-3 py-1.5 text-label-s text-text-brand hover:bg-brand-primary-subtle">
                        View
                      </Link>
                      {a.link?.kind !== "opened" && (
                        <button type="button" onClick={() => unlink(a)} className="rounded-lg px-3 py-1.5 text-label-s text-text-brand hover:bg-brand-primary-subtle">
                          Unlink
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised px-5 py-3.5">
        <Icon name="app/icon-plus-primary-18" size={18} />
        <p className="flex-1 text-body-s text-text-secondary">Found a related alert elsewhere? Link it by ID or search.</p>
        <Button variant="secondary" size="sm" onClick={() => setLinking(true)}>
          Link an alert
        </Button>
      </div>
      <Modal
        open={linking}
        onClose={() => setLinking(false)}
        width={480}
        title={`Link an alert to ${caseId}`}
        description="It moves out of Live alerts and joins this case’s timeline."
        actions={
          <>
            <Button variant="secondary" size="md" onClick={() => setLinking(false)}>
              Cancel
            </Button>
            <Button size="md" onClick={link} loading={busy} disabled={!/^AL-\d+$/i.test(alertId.trim())}>
              Link alert
            </Button>
          </>
        }
      >
        <TextField label="Alert ID" placeholder="AL-88190" mono value={alertId} onChange={(e) => setAlertId(e.target.value)} />
        <RequestError error={failure} />
      </Modal>
    </>
  );
}
