"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { RequestError } from "@/components/auth/RequestError";
import { localMsisdn } from "@/components/cases/CaseTable";
import { ToolbarSelect } from "@/components/cases/Table";
import { Legend, NetworkGraph, nodeRole } from "@/components/network/NetworkGraph";
import { NODE_TYPE, nodeFacts, nodeFlags, type NodeDetail } from "@/components/network/NodePanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCard } from "@/components/ui/Choice";
import { Banner } from "@/components/ui/Banner";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, Select, TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useNetwork, type Network, type NetworkNode } from "@/lib/api/cases";
import { useApi, useMyCases } from "@/lib/api/fd";
import { formatClock, formatMoney } from "@/lib/time";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

/** Query parameters a suggested filter can set on GET /network. */
const FILTER_PARAMS = ["became_fraud", "since", "has_outflow"];
type Filter = Network["suggested_filters"][number];
const FILTER_LABEL: Record<string, (f: Filter) => string> = {
  became_fraud: () => "Only SIM swaps that became fraud",
  today: (f) => `Only today (since ${typeof f.params.since === "string" ? formatClock(f.params.since) : "00:00"})`,
  has_outflow: () => "Hide wallets with no outflow",
};
const filterLabel = (f: Filter) => FILTER_LABEL[f.id]?.(f) ?? f.id.replace(/_/g, " ");
/** G32 · Faint scatter behind the “too large” card, so the size of the thing is felt. */
function Scatter({ count }: { count: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: Math.min(count, 140) }, (_, i) => {
        const a = (i * 137.508 * Math.PI) / 180;
        const r = 40 + ((i * 53) % 260);
        return { x: 50 + Math.cos(a) * (r / 6.2), y: 50 + Math.sin(a) * (r / 4.2), big: i % 4 === 0 };
      }),
    [count],
  );
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {dots.map((d, i) => (
        <g key={i}>
          <line x1={50} y1={50} x2={d.x} y2={d.y} stroke="var(--color-border-default)" strokeWidth={0.08} />
          <circle cx={d.x} cy={d.y} r={d.big ? 0.45 : 0.3} fill="var(--color-border-strong)" />
        </g>
      ))}
    </svg>
  );
}

/** G30 · Add the chosen entities to a case, with why they matter. */
function AddToCaseModal({ network, initial, onClose, onAdded }: { network: Network; initial: string[]; onClose: () => void; onAdded: (caseId: string, ids: string[]) => void }) {
  const { data: cases } = useMyCases();
  const [caseId, setCaseId] = useState("");
  const [picked, setPicked] = useState(new Set(initial));
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const target = caseId || cases?.data[0]?.id || "";
  const label = (id: string) => network.nodes.find((n) => n.id === id);
  const detail = (id: string) => {
    const into = network.edges.find((e) => e.to === id && e.amount);
    const from = into && label(into.from);
    const amount = into?.amount ? formatMoney(into.amount.amount_minor, into.amount.currency) : "";
    const inCase = network.edges.find((e) => e.from === id && e.kind === "in_case")?.to;
    const node = label(id);
    if (!into) return node ? nodeRole(node) : "";
    return `${label(id)?.type === "wallet" ? "Wallet" : "Entity"} · ${from?.type === "subscriber" ? `received ${amount} from the victim` : `got ${amount} from ${localMsisdn(from?.label ?? "")}`}${inCase ? ` · in ${inCase}` : ""}`;
  };

  const add = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await apiFetch("POST", `/cases/${target}/entities`, { entity_ids: Array.from(picked), note: why, snapshot: true });
      onAdded(target, Array.from(picked));
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title="Add to a case"
      description="Entities are linked as evidence. The graph snapshot is attached automatically."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={add} loading={busy} disabled={!picked.size || !why.trim() || !target}>
            Add {picked.size} to {target}
          </Button>
        </>
      }
    >
      <Select label="Case" required value={target} onChange={(e) => setCaseId(e.target.value)}>
        {cases?.data.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} · {c.title} · {c.assignee?.id === "usr_ama" ? "yours" : (c.assignee?.name ?? "unassigned")}
          </option>
        ))}
      </Select>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>Entities · {picked.size} selected</FieldLabel>
        </legend>
        {initial.map((id) => (
          <CheckCard
            key={id}
            title={localMsisdn(label(id)?.label ?? id)}
            description={detail(id)}
            checked={picked.has(id)}
            onChange={(e) =>
              setPicked((p) => {
                const next = new Set(p);
                if (e.target.checked) next.add(id);
                else next.delete(id);
                return next;
              })
            }
          />
        ))}
      </fieldset>
      <TextArea label="Why they matter" required rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What this shows, in a sentence" />
      <RequestError error={failure} />
    </Modal>
  );
}

/** Label / value rows with dividers (the side panel). */
function Rows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 border-b border-border-default py-2.5 text-body-s first:pt-0 last:border-b-0">
          <dt className="shrink-0 text-text-secondary">{k}</dt>
          <dd className="text-right text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** G28–G33 · Entity network — start from any identifier and expand outwards. */
export default function NetworkPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const seed = params.get("seed") ?? "sub_8KQ2";
  const [hops, setHops] = useState("2");
  const [period, setPeriod] = useState("7d");
  const hidden = new Set<string>();
  const [q, setQ] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ caseId: string; ids: string[] } | null>(null);
  const [drawAnyway, setDrawAnyway] = useState(false);
  const filters = Object.fromEntries(FILTER_PARAMS.flatMap((k) => (params.get(k) ? [[k, params.get(k)!]] : [])));
  const { data } = useNetwork(seed, Number(hops), filters);
  const { data: node } = useApi<NodeDetail>(selected ? `/network/nodes/${selected}?context=explore` : null);

  const seedNode = data?.nodes.find((n) => n.id === seed);
  const view: Network | undefined = data && {
    ...data,
    nodes: data.nodes.filter((n) => n.id === seed || !hidden.has(n.type)),
    edges: data.edges.filter((e) => {
      const t = (id: string) => data.nodes.find((n) => n.id === id)?.type;
      return !hidden.has(t(e.from) ?? "") && !hidden.has(t(e.to) ?? "");
    }),
  };
  const counts = (t: NetworkNode["type"]) => view?.nodes.filter((n) => n.type === t).length ?? 0;
  const cases = view?.nodes.filter((n) => n.type === "case").map((n) => n.id) ?? [];
  const seedCase = seedNode?.case_ids?.[0];
  const tooLarge = data?.truncated && !drawAnyway;
  const nameOf = (id: string) => data?.nodes.find((n) => n.id === id)?.label ?? id;

  const setSeed = (next: string) => {
    setSelected(null);
    setAdded(null);
    setDrawAnyway(false);
    router.push(`/network?seed=${encodeURIComponent(next)}`, { scroll: false });
  };
  const search = async () => {
    const v = (q ?? "").trim();
    if (!v) return;
    if (/^(AG|KS|FD)-\d+$/i.test(v)) return setSeed(v.toUpperCase());
    const res = await apiFetch<{ data: Array<{ id: string }> }>("GET", `/search?q=${encodeURIComponent(v)}&type=auto`).catch(() => null);
    if (res?.data[0]) setSeed(res.data[0].id);
    else toast({ title: `Nothing found for “${v}”`, body: "Try the full number, an agent code or a case ID." });
  };

  const exportTable = () => {
    if (!data) return;
    const body = ["id,label,type,risk,relation", ...data.nodes.map((n) => [n.id, n.label, n.type, n.risk, n.relation ?? ""].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `network-${seed}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  // Masked and watermarked by the server.
  const snapshot = async (format: "png" | "pdf") => {
    try {
      await apiFetch("POST", "/network/snapshots", { seed, hops: Number(hops), format });
      toast({ tone: "success", title: `Snapshot saved · ${format.toUpperCase()}`, body: "Masked numbers and a watermark were added. Logged to the audit trail." });
    } catch {
      toast({ title: "Snapshot not saved", body: "Try again in a moment." });
    }
  };

  const seedLabel = localMsisdn(seedNode?.label ?? seed).replace(/, .*$/, "");
  const PERIOD: Record<string, string> = { "24h": "last 24 hours", "7d": "last 7 days", "30d": "last 30 days" };
  const FILTER_ICON: Record<string, string> = { became_fraud: "app/icon-filter-secondary-16", today: "app/icon-clock-secondary-16", has_outflow: "app/icon-eye-off-16" };
  const typeName = node ? NODE_TYPE[node.type] : "";

  return (
    <>
      <AppHeader section="Investigate" title="Entity network" />
      <PageBody>
        <PageHead
          title="Entity network"
          subtitle="See how subscribers, wallets, devices, agents and cases connect. Start from any identifier and expand outwards."
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => snapshot("png")} disabled={!data || tooLarge}>
                Save snapshot
              </Button>
              {/* G33 · Export a visual. */}
              <Menu
                label="Export this view"
                width={300}
                trigger={(t) => (
                  <Button variant="secondary" size="md" onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu" disabled={!data || tooLarge}>
                    Export
                  </Button>
                )}
              >
                {(close) => (
                  <>
                    <MenuLabel>Export this view</MenuLabel>
                    <MenuItem
                      icon="app/icon-file-secondary-18"
                      title="Image · PNG"
                      description="Exactly what you see, 2 times sharper"
                      onSelect={() => (close(), snapshot("png"))}
                    />
                    <MenuItem icon="app/icon-file-secondary-18" title="PDF" description="With the key and a title" onSelect={() => (close(), snapshot("pdf"))} />
                    <MenuItem
                      icon="app/icon-folder-secondary-16"
                      title="Add to a case as evidence"
                      description={`Saves a snapshot to ${seedCase ?? "a case"}`}
                      onSelect={() => {
                        close();
                        setAdding(true);
                      }}
                    />
                    <p className="px-2.5 py-2 text-caption text-text-secondary">Numbers stay masked and a watermark is added.</p>
                  </>
                )}
              </Menu>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 w-[280px] shrink-0 items-center gap-2 rounded-lg border border-border-strong bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-focus">
            <Icon name="app/icon-search-tertiary-16" size={16} />
            <input
              aria-label="Start from"
              value={q ?? seedLabel}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Number, wallet, IMEI, agent or case"
              className="min-w-0 flex-1 bg-transparent text-body-s text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
            />
          </label>
          <ToolbarSelect
            label="Hops"
            value={hops}
            onChange={setHops}
            options={[
              ["1", "1 hop"],
              ["2", "2 hops"],
              ["3", "3 hops"],
            ]}
          />
          <ToolbarSelect
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              ["24h", "Last 24 hours"],
              ["7d", "Last 7 days"],
              ["30d", "Last 30 days"],
            ]}
          />
        </div>

        <div className="flex items-start gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <section aria-label="Graph" className="flex flex-col rounded-lg border border-border-default bg-surface-base">
              <div className="flex min-h-8 items-center justify-between gap-4 px-6 pt-5">
                <h3 className="text-title text-text-primary">{data ? `${seedLabel}, ${data.returned_hops} ${data.returned_hops === 1 ? "hop" : "hops"}` : ""}</h3>
                {data && (
                  <CardMeta>
                    {data.truncated
                      ? `${data.shown_entities ?? data.nodes.length} of ${data.total_entities.toLocaleString("en-GB")} entities`
                      : `${data.total_entities} entities · ${PERIOD[period]}`}
                  </CardMeta>
                )}
              </div>
              <div className="relative h-[460px] overflow-hidden rounded-b-lg">
                {!view ? (
                  <div className="p-6">
                    <Skeleton className="h-[400px] w-full" />
                  </div>
                ) : tooLarge ? (
                  /* G32 · Graph too large. */
                  <>
                    <div className="absolute inset-y-0 left-0 w-[70%]">
                      <Scatter count={data.shown_entities ?? 186} />
                      <span className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-text-primary bg-surface-base" />
                    </div>
                    <div
                      role="dialog"
                      aria-label="Too many to draw"
                      className="absolute top-1/2 right-10 flex w-[324px] -translate-y-1/2 flex-col gap-3 rounded-lg border border-border-default bg-surface-base p-3.5 shadow-lg"
                    >
                      <div className="flex gap-2.5 rounded-lg border border-medium-border bg-medium-bg px-3 py-2.5">
                        <Icon name="app/icon-alert-triangle-medium-16" size={16} className="mt-0.5 shrink-0" />
                        <span className="flex flex-col">
                          <span className="text-label-s text-medium-fg">
                            {data.total_entities.toLocaleString("en-GB")} entities at {hops} hops. Too many to draw
                          </span>
                          <span className="text-body-s text-text-secondary">
                            Showing {seedLabel}’s direct connections only ({data.shown_entities}).
                          </span>
                        </span>
                      </div>
                      <p className="text-label-s text-text-primary">Narrow it down</p>
                      <div className="flex flex-col">
                        {data.suggested_filters.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              const qs = new URLSearchParams({ seed, ...Object.fromEntries(Object.entries(f.params).map(([k, v]) => [k, String(v)])) });
                              router.push(`/network?${qs}`, { scroll: false });
                            }}
                            className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-surface-sunken"
                          >
                            <Icon name={FILTER_ICON[f.id] ?? "app/icon-filter-secondary-16"} size={16} className="mt-0.5 shrink-0" />
                            <span className="flex flex-col">
                              <span className="text-body-s text-text-primary">{filterLabel(f)}</span>
                              <span className="text-caption text-text-secondary">
                                {f.id === "has_outflow" ? "About " : ""}
                                {f.estimate.toLocaleString("en-GB")} entities
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => setDrawAnyway(true)}>
                          Draw anyway (slow)
                        </Button>
                        <Button variant="secondary" size="sm" onClick={exportTable}>
                          Export as table
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <NetworkGraph network={view} seed={seed} selected={selected} onSelect={setSelected} height={420} />
                )}
              </div>
            </section>
            {!tooLarge && <Legend />}
          </div>

          {selected && node ? (
            /* G29 · Node selected (G31 once it’s in a case). */
            <Card
              title={`${typeName} ${localMsisdn(node.identifier)}`}
              aside={
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setSelected(null)}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken"
                >
                  <Icon name="app/icon-x-primary-18" size={16} />
                </button>
              }
              className="w-[324px] shrink-0"
            >
              <div className="-mt-2 flex flex-wrap gap-1.5">
                {nodeFlags(node).map((b) => (
                  <Badge key={b.label} label={b.label} tone={b.tone} />
                ))}
                {added?.ids.includes(selected) && <Badge label={`In ${added.caseId}`} tone="brand" />}
              </div>
              <Rows
                rows={[...(node.owner_name ? ([["Owner", `${node.owner_name} (masked)`]] as Array<[string, ReactNode]>) : []), ...nodeFacts(node, (id) => localMsisdn(nameOf(id)))]}
              />
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="md" fullWidth disabled={Boolean(added?.ids.includes(selected))} onClick={() => setAdding(true)}>
                  {added?.ids.includes(selected) ? `Added to ${added.caseId}` : `Add ${typeName.toLowerCase()} to evidence`}
                </Button>
                <Button variant="secondary" size="md" fullWidth onClick={() => setSeed(selected)}>
                  Expand from here
                </Button>
                {node.type === "subscriber" && (
                  <Button variant="secondary" size="md" fullWidth onClick={() => router.push(`/subscribers/${selected}`)}>
                    Open profile
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <Card title="In this view" className="w-[324px] shrink-0">
              {!data ? (
                <Skeleton className="h-[200px] w-full" />
              ) : data.summary ? (
                <Rows
                  rows={[
                    ["Seed", `${seedLabel} · ${data.summary.seed_type}`],
                    ["Showing", `${data.returned_hops} hop${data.returned_hops === 1 ? "" : "s"} · ${data.shown_entities ?? data.nodes.length} entities`],
                    ["Subscribers swapped", `${data.summary.subscribers_swapped_30d} this month`],
                    ["Became fraud", [String(data.summary.became_fraud_case_ids.length), data.summary.became_fraud_case_ids.join(", ")].filter(Boolean).join(" · ")],
                  ]}
                />
              ) : (
                <>
                  <Rows
                    rows={[
                      ["Subscribers", String(counts("subscriber"))],
                      ["Wallets", `${counts("wallet")}${data.new_today?.wallet ? ` · ${data.new_today.wallet} new today` : ""}`],
                      ["Devices", String(counts("device"))],
                      ["Agents", String(counts("agent"))],
                      [
                        "Linked cases",
                        <span key="c">
                          {[...cases, ...(seedNode?.case_ids ?? [])]
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .map((c, i) => (
                              <span key={c}>
                                {i > 0 && ", "}
                                <button type="button" onClick={() => router.push(`/cases/${c}`)} className="rounded hover:underline">
                                  {c}
                                </button>
                              </span>
                            ))}
                        </span>,
                      ],
                    ]}
                  />
                  {data.insight && (
                    <Banner tone="warning" icon="app/icon-alert-triangle-medium-16" title={data.insight.title}>
                      {data.insight.detail}
                    </Banner>
                  )}
                </>
              )}
            </Card>
          )}
        </div>
      </PageBody>

      {adding && data && (
        <AddToCaseModal
          network={data}
          initial={
            node?.add_to_case?.suggested ??
            (selected
              ? [selected]
              : data.nodes
                  .filter((n) => n.type === "wallet")
                  .slice(0, 3)
                  .map((n) => n.id))
          }
          onClose={() => setAdding(false)}
          onAdded={(caseId, ids) => {
            setAdding(false);
            setAdded({ caseId, ids });
            toast({
              tone: "success",
              title: `${ids.length} ${ids.length === 1 ? "entity" : "entities"} added to ${caseId}`,
              body: "Graph snapshot attached · note added to the timeline.",
              action: { label: "Open case", onClick: () => router.push(`/cases/${caseId}`) },
            });
          }}
        />
      )}
    </>
  );
}
