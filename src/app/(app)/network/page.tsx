"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { RequestError } from "@/components/auth/RequestError";
import { Legend, NetworkGraph, TYPE_COLOR } from "@/components/network/NetworkGraph";
import type { NodeDetail } from "@/components/network/NodePanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCard } from "@/components/ui/Choice";
import { KeyValueList } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, Select, TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useNetwork, type Network, type NetworkNode } from "@/lib/api/cases";
import { useApi, useMyCases } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Explore = NodeDetail & { subtitle?: string; type?: NetworkNode["type"]; add_to_case?: { suggested: string[] } };
const TYPES: Array<[NetworkNode["type"], string]> = [
  ["subscriber", "Subscribers"],
  ["wallet", "Wallets"],
  ["device", "Devices"],
  ["agent", "Agents"],
  ["case", "Cases"],
];

function ToolbarSelect({ icon, label, value, onChange, options }: { icon: string; label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="relative flex h-10 w-[160px] items-center gap-2 rounded-lg border border-border-default bg-surface-base pr-8 pl-3 focus-within:border-border-focus focus-within:shadow-focus">
      <Icon name={icon} size={16} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent text-body-m text-text-primary outline-none focus-visible:shadow-none">
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
      <Icon name="app/icon-chevron-down-16" size={16} className="pointer-events-none absolute right-3" />
    </label>
  );
}

/** G32 · Faint scatter behind the “too large” card, so the size of the thing is felt. */
function Scatter({ count }: { count: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: Math.min(count, 140) }, (_, i) => {
        const a = (i * 137.508 * Math.PI) / 180;
        const r = 40 + ((i * 53) % 260);
        return { x: 50 + Math.cos(a) * (r / 6.2), y: 50 + Math.sin(a) * (r / 4.2), c: ["#d63c3c", "#5347ce", "#c98a1b"][i % 3] };
      }),
    [count],
  );
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {dots.map((d, i) => (
        <g key={i} opacity={0.18}>
          <line x1={50} y1={50} x2={d.x} y2={d.y} stroke="#a8a5bd" strokeWidth={0.08} />
          <circle cx={d.x} cy={d.y} r={0.35} fill={d.c} />
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
    const amount = into?.amount ? `GHS ${(into.amount.amount_minor / 100).toLocaleString("en-GB")}` : "";
    const inCase = network.edges.find((e) => e.from === id && e.kind === "in_case")?.to;
    if (!into) return label(id)?.role ?? "";
    return `${label(id)?.type === "wallet" ? "Wallet" : "Entity"} · ${from?.type === "subscriber" ? `received ${amount} from the victim` : `got ${amount} from ${from?.label}`}${inCase ? ` · in ${inCase}` : ""}`;
  };

  const add = async () => {
    setBusy(true);
    setFailure(null);
    try {
      // TODO(api): proposed POST /cases/{id}/entities {entity_ids, note, snapshot}.
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
      width={560}
      icon="app/icon-folder-brand-20"
      tone="brand"
      title="Add to a case"
      description="Entities are linked as evidence. The graph snapshot is attached automatically."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={add} loading={busy} disabled={!picked.size || !why.trim() || !target} iconLeft={<Icon name="app/icon-folder-white-18" size={18} />}>
            Add {picked.size} to {target}
          </Button>
        </>
      }
    >
      <Select label="Case" required value={target} onChange={(e) => setCaseId(e.target.value)}>
        {cases?.data.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} · {c.title} · {c.assignee?.id === "usr_ama" ? "yours" : c.assignee?.name ?? "unassigned"}
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
            title={<span className="font-mono text-mono-m">{label(id)?.label ?? id}</span>}
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
      <TextArea label="Why they matter" required rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What this shows, in a sentence" />
      <RequestError error={failure} />
    </Modal>
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
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [q, setQ] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ caseId: string; ids: string[] } | null>(null);
  const [drawAnyway, setDrawAnyway] = useState(false);
  const { data } = useNetwork(seed, Number(hops));
  const { data: node } = useApi<Explore>(selected ? `/network/nodes/${selected}?context=explore` : null);

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
  const tooLarge = data?.truncated && !drawAnyway;

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
    const body = ["id,label,type,risk,role", ...data.nodes.map((n) => [n.id, n.label, n.type, n.risk, n.role ?? ""].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `network-${seed}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const snapshot = (kind: "png" | "pdf") =>
    // TODO(api): proposed POST /network/snapshots {seed, hops, filters, format} — masked and watermarked server-side.
    toast({ tone: "success", title: `Snapshot saved · ${kind.toUpperCase()}`, body: "Masked numbers and a watermark were added. Logged to the audit trail." });

  return (
    <>
      <AppHeader section="Investigate" title="Entity network" />
      <PageBody>
        <PageHead
          title="Entity network"
          subtitle="See how subscribers, wallets, devices, agents and cases connect. Start from any identifier and expand outwards."
          actions={
            <Menu
              label="Export this view"
              width={340}
              trigger={(t) => (
                <Button variant="secondary" size="md" onClick={t.toggle} aria-expanded={t["aria-expanded"]} aria-haspopup="menu" disabled={!data || tooLarge} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
                  Save snapshot
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Export this view</MenuLabel>
                  <MenuItem icon="app/icon-file-brand-20" title="Image · PNG" description="Exactly what you see, 2× sharp" onSelect={() => (close(), snapshot("png"))} />
                  <MenuItem icon="app/icon-file-brand-20" title="PDF" description="With legend and title" onSelect={() => (close(), snapshot("pdf"))} />
                  <MenuItem
                    icon="app/icon-folder-brand-20"
                    title="Add to case as evidence"
                    description={`Saves a snapshot to ${seedNode?.role?.match(/FD-\d+/)?.[0] ?? "a case"}`}
                    onSelect={() => {
                      close();
                      setAdding(true);
                    }}
                  />
                  <p className="flex items-center gap-2 px-2.5 py-2 text-caption text-text-tertiary">
                    <Icon name="icon-lock-secondary-16" size={14} />
                    Masked numbers and a watermark are added automatically.
                  </p>
                </>
              )}
            </Menu>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-10 w-[300px] items-center gap-2.5 rounded-lg border border-border-default bg-surface-base px-3.5 focus-within:border-border-focus focus-within:shadow-focus">
            <Icon name="app/icon-search-18" size={18} />
            <input
              aria-label="Start from"
              value={q ?? seedNode?.label ?? seed}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="min-w-0 flex-1 bg-transparent font-mono text-mono-m text-text-primary outline-none focus-visible:shadow-none"
            />
            <button type="button" aria-label="Clear" onClick={() => setQ("")} className="flex rounded">
              <Icon name="app/icon-x-primary-18" size={16} />
            </button>
          </label>
          <ToolbarSelect
            icon="app/icon-network-secondary-18"
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
            icon="app/icon-clock-secondary-16"
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              ["24h", "Last 24 hours"],
              ["7d", "Last 7 days"],
              ["30d", "Last 30 days"],
            ]}
          />
          <span className="flex-1" />
          <div className="flex gap-1.5" role="group" aria-label="Show entity types">
            {TYPES.map(([t, label]) => (
              <button
                key={t}
                type="button"
                aria-pressed={!hidden.has(t)}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(t)) next.delete(t);
                    else next.add(t);
                    return next;
                  })
                }
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3 text-caption font-medium",
                  hidden.has(t) ? "border-border-subtle text-text-tertiary" : "border-border-default bg-surface-base text-text-primary",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: hidden.has(t) ? "#d4d4d4" : TYPE_COLOR[t] }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="relative h-[600px] overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
              {!view ? (
                <div className="p-6">
                  <Skeleton className="h-[540px] w-full" />
                </div>
              ) : tooLarge ? (
                <>
                  <Scatter count={data.shown_entities ?? 186} />
                  <span
                    className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-high-bg"
                    style={{ borderColor: TYPE_COLOR.agent }}
                  >
                    <Icon name="app/icon-building-high-20" size={20} />
                  </span>
                  <div role="dialog" aria-label="Too many to draw" className="absolute top-1/2 left-1/2 flex w-[420px] translate-x-[10px] -translate-y-[45%] flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-base px-5 py-5 shadow-lg">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-medium-bg">
                        <Icon name="app/icon-alert-triangle-medium-16" size={18} />
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-title text-text-primary">
                          {data.total_entities.toLocaleString("en-GB")} entities at 2 hops. Too many to draw
                        </span>
                        <span className="text-caption text-text-secondary">
                          Showing {seed}’s direct connections only ({data.shown_entities}).
                        </span>
                      </span>
                    </div>
                    <p className="text-overline text-text-tertiary uppercase">Narrow it down</p>
                    {data.suggested_filters.map((f) => (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => {
                          // TODO(api): suggested_filters.params map onto GET /network query params.
                          const qs = new URLSearchParams({ seed, ...Object.fromEntries(Object.entries(f.params).map(([k, v]) => [k, String(v)])) });
                          router.push(`/network?${qs}`, { scroll: false });
                          setHops("1");
                        }}
                        className="flex items-center gap-3 rounded-[10px] border border-border-default px-3.5 py-2.5 text-left hover:border-brand-primary"
                      >
                        <span className="flex flex-1 flex-col">
                          <span className="text-label-m text-text-primary">{f.label}</span>
                          <span className="text-caption text-text-secondary">{f.detail ?? `${f.estimate} entities`}</span>
                        </span>
                        <Icon name="app/icon-arrow-right-brand-16" size={16} />
                      </button>
                    ))}
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setDrawAnyway(true)} className="rounded text-label-s text-text-brand hover:underline">
                        Draw anyway (slow)
                      </button>
                      <Button variant="secondary" size="sm" onClick={exportTable} iconLeft={<Icon name="app/icon-download-18" size={16} />}>
                        Export as table
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <NetworkGraph network={view} seed={seed} selected={selected} onSelect={setSelected} height={560} />
              )}
            </div>
            <Legend />
          </div>

          {selected && node ? (
            <section aria-label="Selected entity" className="flex w-[400px] shrink-0 flex-col gap-3 rounded-xl border border-border-subtle bg-surface-base px-[18px] py-4">
              <header className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-title text-text-primary">
                  <Icon name="app/icon-circle-dashed-16" size={16} />
                  Selected
                </h3>
                <button type="button" aria-label="Clear selection" onClick={() => setSelected(null)} className="flex size-8 items-center justify-center rounded-lg border border-border-default">
                  <Icon name="app/icon-x-primary-18" size={16} />
                </button>
              </header>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full border-[1.5px]" style={{ borderColor: TYPE_COLOR[node.type ?? "wallet"], background: "#efedfb" }}>
                  <Icon name="app/icon-wallet-18" size={18} />
                </span>
                <span className="flex flex-col">
                  <span className="font-mono text-mono-m font-semibold text-text-primary">{node.title}</span>
                  {node.subtitle && <span className="text-caption text-text-secondary">{node.subtitle}</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {node.badges.map((b) => (
                  <Badge key={b.label} label={b.label} tone={b.tone} dot={b.tone === "critical"} />
                ))}
                {added?.ids.includes(selected) && <Badge label={`In ${added.caseId}`} tone="brand" dot />}
              </div>
              <KeyValueList rows={node.facts.map(([k, v, tone]) => [k, <span key={k} className={cn(tone === "critical" && "text-critical-fg")}>{v}</span>])} />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSeed(selected)} iconLeft={<Icon name="app/icon-plus-primary-18" size={16} />}>
                  Expand
                </Button>
                <Button variant="secondary" size="sm" onClick={() => router.push(`/subscribers/${selected}`)} iconLeft={<Icon name="app/icon-external-18" size={16} />}>
                  Open profile
                </Button>
              </div>
              <Button
                size="md"
                fullWidth
                disabled={Boolean(added?.ids.includes(selected))}
                onClick={() => setAdding(true)}
                iconLeft={<Icon name={added?.ids.includes(selected) ? "app/icon-check-white-18" : "app/icon-folder-white-18"} size={18} />}
              >
                {added?.ids.includes(selected) ? `Added to ${added.caseId}` : "Add to case"}
              </Button>
            </section>
          ) : (
            <section aria-label="In this view" className="flex w-[400px] shrink-0 flex-col gap-3 rounded-xl border border-border-subtle bg-surface-base px-[18px] py-4">
              <h3 className="flex items-center gap-2 text-title text-text-primary">
                <Icon name="app/icon-network-secondary-18" size={16} />
                In this view
              </h3>
              {!data ? (
                <Skeleton className="h-[200px] w-full" />
              ) : data.summary ? (
                <KeyValueList rows={data.summary.map(([k, v, tone]) => [k, <span key={k} className={cn(tone === "critical" && "text-critical-fg")}>{v}</span>])} />
              ) : (
                <>
                  <KeyValueList
                    rows={[
                      ["Subscribers", String(counts("subscriber"))],
                      [
                        "Wallets",
                        <span key="w" className={cn(Boolean(data.new_today?.wallet) && "text-critical-fg")}>
                          {counts("wallet")}
                          {data.new_today?.wallet ? ` · ${data.new_today.wallet} new today` : ""}
                        </span>,
                      ],
                      ["Devices", String(counts("device"))],
                      ["Agents", String(counts("agent"))],
                      [
                        "Linked cases",
                        <span key="c" className="flex gap-1">
                          {[...cases, ...(seedNode?.role?.match(/FD-\d+/) ?? [])]
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .map((c, i) => (
                              <span key={c}>
                                {i > 0 && " · "}
                                <button type="button" onClick={() => router.push(`/cases/${c}`)} className="rounded text-text-brand hover:underline">
                                  {c}
                                </button>
                              </span>
                            ))}
                        </span>,
                      ],
                    ]}
                  />
                  {data.insight && (
                    <div className="flex gap-2.5 rounded-[10px] border border-medium-border bg-medium-bg px-3.5 py-3">
                      <Icon name="app/icon-alert-triangle-medium-16" size={18} className="mt-0.5 shrink-0" />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-label-m text-medium-fg">{data.insight.title}</span>
                        <span className="text-caption text-text-primary">{data.insight.detail}</span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </PageBody>

      {adding && data && (
        <AddToCaseModal
          network={data}
          initial={node?.add_to_case?.suggested ?? (selected ? [selected] : data.nodes.filter((n) => n.type === "wallet").slice(0, 3).map((n) => n.id))}
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
