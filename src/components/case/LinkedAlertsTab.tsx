"use client";

import { RequestError } from "@/components/auth/RequestError";
import { RiskScore } from "@/components/app/indicators";
import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useLinkedAlerts, type LinkedAlert } from "@/lib/api/cases";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { firstName, table } from "./parts";

function howLinked(a: LinkedAlert, meId?: string) {
  if (a.link.kind === "opened") return { label: "Opened case", tone: "brand" as const };
  if (a.link.kind === "auto") return { label: "Auto-linked", tone: "neutral" as const };
  const by = a.link.by;
  return { label: by ? `Added by ${by.id === meId ? firstName(by.name) : by.name}` : "Added", tone: "neutral" as const };
}

/** C3 · Linked alerts — what joined the case and how; unlink from the row menu, or link another below. */
export function LinkedAlertsTab({ caseId, meId, now }: { caseId: string; meId?: string; now: number }) {
  const { data, isLoading } = useLinkedAlerts(caseId);
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const toast = useToast();
  const [alertId, setAlertId] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [unlinked, setUnlinked] = useState<string[]>([]);

  const rows = (data?.data ?? []).filter((a) => !unlinked.includes(a.id));
  const valid = /^AL-\d+$/i.test(alertId.trim());

  const unlink = async (a: LinkedAlert) => {
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
    if (!valid) return;
    const id = alertId.trim().toUpperCase();
    setBusy(true);
    setFailure(null);
    try {
      await apiFetch("POST", `/alerts/${id}/attach`, { case_id: caseId });
      await mutate(`/cases/${caseId}/linked-alerts`);
      setAlertId("");
      toast({ tone: "success", title: `${id} linked to ${caseId}`, body: "It moved out of Live alerts and joined this case’s timeline." });
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={table.wrap}>
        <table className="w-full table-fixed">
          <thead>
            <tr className={table.head}>
              <th className="w-[84px] pl-4 font-normal">Time</th>
              <th className="w-[118px] font-normal">Risk</th>
              <th className="font-normal">Signal</th>
              <th className="w-[134px] font-normal">Where</th>
              <th className="w-[180px] font-normal">How linked</th>
              <th className="w-14 pr-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-4">
                  <Skeleton className="h-8 w-full" />
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const how = howLinked(a, meId);
              const when = formatWhen(a.created_at, now);
              return (
                <tr key={a.id} className={cn(table.row, "h-[54px]")}>
                  <td className="pl-4 text-body-s text-text-primary">{when === formatClock(a.created_at) ? when : `${when} ${formatClock(a.created_at)}`}</td>
                  <td>
                    <RiskScore score={a.risk_score} />
                  </td>
                  <td className="pr-4">
                    <span className="flex flex-col">
                      <span className="truncate text-label-s text-text-primary">{a.title}</span>
                      <span className="truncate text-caption text-text-tertiary">{[a.id, a.rule_ids.join(", ")].filter(Boolean).join(" · ")}</span>
                    </span>
                  </td>
                  <td className="text-body-s text-text-primary">{a.region}</td>
                  <td>
                    <Badge label={how.label} tone={how.tone} />
                  </td>
                  <td className="pr-4">
                    <Menu
                      label={`Actions for ${a.id}`}
                      width={200}
                      trigger={(t) => (
                        <button
                          type="button"
                          aria-label={`Actions for ${a.id}`}
                          onClick={t.toggle}
                          aria-expanded={t["aria-expanded"]}
                          aria-haspopup="menu"
                          className="ml-auto flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken"
                        >
                          <Icon name="app/icon-more-16" size={16} />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem
                            title="View alert"
                            onSelect={() => {
                              close();
                              router.push(`/alerts?alert=${a.id}`);
                            }}
                          />
                          {a.link.kind !== "opened" && (
                            <MenuItem
                              title="Unlink from case"
                              tone="critical"
                              onSelect={() => {
                                close();
                                void unlink(a);
                              }}
                            />
                          )}
                        </>
                      )}
                    </Menu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && (
          <p className={table.foot}>
            {rows.length} linked {rows.length === 1 ? "alert" : "alerts"}
          </p>
        )}
      </div>
      <Card title="Link another alert" aside={<CardMeta>By alert ID</CardMeta>}>
        <form
          className="flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void link();
          }}
        >
          <TextField
            size="md"
            aria-label="Alert ID"
            placeholder="Search alerts, e.g. AL-88190"
            value={alertId}
            onChange={(e) => setAlertId(e.target.value)}
            iconLeft={<Icon name="app/icon-search-tertiary-16" size={16} />}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" size="md" className="h-10" loading={busy} disabled={!valid}>
            Link alert
          </Button>
        </form>
        <RequestError error={failure} />
      </Card>
    </>
  );
}
