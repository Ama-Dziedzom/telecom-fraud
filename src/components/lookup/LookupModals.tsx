"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CheckCard, Checkbox } from "@/components/ui/Choice";
import { Segmented } from "@/components/ui/Segmented";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { FieldLabel, Select } from "@/components/ui/TextField";
import { apiFetch } from "@/lib/api/client";
import { useMyCases, type SearchHit } from "@/lib/api/fd";
import { formatDate } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Row = { line: number; value: string; problem?: string };

/** “Kumasi, Ashanti · Tier 2 wallet” — the line under a subscriber search hit. */
export function hitSubtitle(s: NonNullable<SearchHit["subscriber"]>) {
  return [s.area, s.wallet_tier ? `Tier ${s.wallet_tier} wallet` : ""].filter(Boolean).join(" · ");
}

/** “Ported out · inactive since 1 Mar 2024”, or nothing for an active number. */
export function hitNote(s: NonNullable<SearchHit["subscriber"]>) {
  if (s.status === "active") return "";
  const status = s.status === "ported_out" ? "Ported out" : s.status.charAt(0).toUpperCase() + s.status.slice(1).replace(/_/g, " ");
  return s.inactive_since ? `${status} · inactive since ${formatDate(s.inactive_since)}` : status;
}

/** Accepts 0XX XXX XXXX, +233 XX XXX XXXX, a 15-digit IMEI, or a wallet ID. */
export function identifierProblem(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "empty";
  if (/^gha-/i.test(v) || /^(wal|ag|ks)[-_]/i.test(v)) return null;
  const digits = v.replace(/\D/g, "");
  if (/^[\d\s+()-]+$/.test(v)) {
    if (digits.length === 15) return null;
    const local = digits.startsWith("233") ? digits.slice(3) : digits.replace(/^0/, "");
    if (local.length < 9) return "is too short";
    if (local.length > 9) return "is too long";
    return null;
  }
  return null;
}

function parse(text: string): Row[] {
  const seen = new Map<string, number>();
  return text
    .split(/\r?\n/)
    .map((l) => l.split(",")[0].trim())
    .filter((v, i) => v && !(i === 0 && /[a-z]/i.test(v) && !/^gha|^wal|^ag/i.test(v)))
    .map((value, i) => {
      const line = i + 1;
      const key = value.replace(/\D/g, "") || value.toLowerCase();
      const problem = identifierProblem(value);
      if (problem) return { line, value, problem: `“${value}” ${problem}` };
      if (seen.has(key)) return { line, value, problem: `duplicate of row ${seen.get(key)}` };
      seen.set(key, line);
      return { line, value };
    });
}

/** G18 · Bulk lookup — a CSV or pasted list, checked before it’s sent. */
export function BulkLookupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: cases } = useMyCases();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; rows: Row[] } | null>(null);
  const [caseId, setCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const valid = file?.rows.filter((r) => !r.problem) ?? [];
  const bad = file?.rows.filter((r) => r.problem) ?? [];

  const read = async (f: File | undefined) => {
    if (!f) return;
    setFile({ name: f.name, rows: parse(await f.text()).slice(0, 500) });
  };

  const go = async () => {
    setBusy(true);
    setFailure(null);
    try {
      // The case is the reason, for the audit log.
      const res = await apiFetch<{ id: string }>("POST", "/lookups/bulk", { identifiers: valid.map((r) => r.value), case_id: caseId, file_name: file?.name });
      router.push(`/lookup/bulk/${res.id}`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={540}
      icon="app/icon-file-brand-20"
      tone="brand"
      title="Bulk lookup"
      description="Up to 500 numbers, IMEIs or wallet IDs · CSV or paste"
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={go} loading={busy} disabled={!valid.length || !caseId} iconLeft={<Icon name="app/icon-search-white-18" size={18} />}>
            Look up {valid.length}
            {bad.length ? ` · skip ${bad.length}` : ""}
          </Button>
        </>
      }
    >
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void read(e.dataTransfer.files[0]);
        }}
        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface-raised px-6 py-7 text-center focus-within:shadow-focus"
      >
        <Icon name="app/icon-file-brand-20" size={22} />
        {file ? (
          <>
            <span className="text-label-m text-text-primary">
              {file.name} · {file.rows.length} rows
            </span>
            <span className={bad.length ? "text-caption text-medium-fg" : "text-caption text-success-fg"}>
              {valid.length} valid{bad.length ? ` · ${bad.length} need fixing` : ""}
            </span>
          </>
        ) : (
          <>
            <span className="text-label-m text-text-primary">Drop a CSV here, or choose a file</span>
            <span className="text-caption text-text-secondary">One identifier per row. The first column is used.</span>
          </>
        )}
        <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void read(e.target.files?.[0])} />
      </label>
      {bad.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-medium-bg px-3.5 py-3 text-caption text-medium-fg">
          {bad.slice(0, 5).map((r) => (
            <p key={r.line}>
              Row {r.line} · {r.problem}
            </p>
          ))}
          {bad.length > 5 && <p>…and {bad.length - 5} more</p>}
        </div>
      )}
      <Select label="Reason" required value={caseId} onChange={(e) => setCaseId(e.target.value)}>
        <option value="" disabled>
          Choose the case this is for
        </option>
        {cases?.data.map((c) => (
          <option key={c.id} value={c.id}>
            Investigating {c.id} · {c.title}
          </option>
        ))}
      </Select>
      <RequestError error={failure} />
    </Modal>
  );
}

const NEEDS = [
  ["active", "Is it active, and since when"],
  ["sim_swaps", "Recent SIM swaps"],
  ["name", "Registered name"],
] as const;

const OPERATORS = [
  { id: "op_volta", name: "Volta Telecom" },
  { id: "op_savanna", name: "Savanna Mobile" },
];

/** G20 · Request subscriber info from another operator, under the inter-operator MoU. */
export function RequestInfoModal({ identifier, operator, onClose }: { identifier: string; operator: { id: string; name: string } | null; onClose: () => void }) {
  const toast = useToast();
  const { data: cases } = useMyCases();
  const [opId, setOpId] = useState(operator?.id ?? OPERATORS[0].id);
  const op = OPERATORS.find((o) => o.id === opId)?.name ?? operator?.name ?? opId;
  const [caseId, setCaseId] = useState("");
  const [needs, setNeeds] = useState<Set<string>>(new Set(["active", "sim_swaps"]));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const linked = caseId || cases?.data[0]?.id || "";

  const send = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await apiFetch("POST", "/operator-requests", { operator_id: opId, identifier, case_id: linked, needs: Array.from(needs) });
      toast({ tone: "success", title: `Request sent to ${op}`, body: `Usually answered within 1 working day. The reply is attached to ${linked}.` });
      onClose();
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={540}
      icon="app/icon-send-brand-22"
      tone="brand"
      title="Request subscriber info"
      description={`${identifier}${operator ? ` · looks like a ${operator.name} number` : ""}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy} disabled={!needs.size || !linked} iconLeft={<Icon name="app/icon-send-white-18" size={18} />}>
            Send request
          </Button>
        </>
      }
    >
      <Select label="Operator" required value={opId} onChange={(e) => setOpId(e.target.value)}>
        {[...OPERATORS, ...(operator && !OPERATORS.some((o) => o.id === operator.id) ? [operator] : [])].map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} · fraud desk
          </option>
        ))}
      </Select>
      <Select label="Linked case" required value={linked} onChange={(e) => setCaseId(e.target.value)}>
        {cases?.data.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} · {c.title}
          </option>
        ))}
      </Select>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>What you need</FieldLabel>
        </legend>
        {NEEDS.map(([id, label]) => (
          <CheckCard
            key={id}
            title={label}
            checked={needs.has(id)}
            onChange={(e) =>
              setNeeds((n) => {
                const next = new Set(n);
                if (e.target.checked) next.add(id);
                else next.delete(id);
                return next;
              })
            }
          />
        ))}
      </fieldset>
      <Banner tone="info" title="Shared under the inter-operator fraud MoU">
        Usually answered within 1 working day. The reply is attached to {linked || "the case"}.
      </Banner>
      <RequestError error={failure} />
    </Modal>
  );
}

const WATCH_REASONS = [
  ["victim_repeat", "Recent fraud victim: protect from repeat"],
  ["mule", "Suspected mule"],
  ["linked_to_case", "Linked to an open case"],
  ["gateway", "Possible bypass gateway"],
] as const;

/** G34 · Add to watchlist — one entity, or several from a bulk lookup. */
export function WatchModal({
  title,
  subtitle,
  entityIds,
  caseId,
  onClose,
}: {
  title: string;
  subtitle?: string;
  entityIds: string[];
  caseId?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<string>(WATCH_REASONS[0][0]);
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [top, setTop] = useState(true);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const watch = async () => {
    setBusy(true);
    setFailure(null);
    try {
      // Your own watchlist; /watchlist is case monitoring after closing.
      await apiFetch("POST", "/me/watchlist", { entity_ids: entityIds, reason, days: Number(days), priority: top, shared, case_id: caseId });
      toast({ tone: "success", title: `Watching ${entityIds.length === 1 ? title.replace(/^Watch /, "") : `${entityIds.length} numbers`}`, body: `For ${days} days${top ? " · new alerts go to the top of your queue" : ""}.` });
      onClose();
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={500}
      icon="app/icon-eye-brand-24"
      tone="brand"
      title={title}
      description={subtitle}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={watch} loading={busy} iconLeft={<Icon name="app/icon-eye-white-20" size={18} />}>
            Start watching
          </Button>
        </>
      }
    >
      <Select label="Why" required value={reason} onChange={(e) => setReason(e.target.value)}>
        {WATCH_REASONS.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-2">
        <FieldLabel>For</FieldLabel>
        <div className="w-fit">
          <Segmented
            label="For"
            value={days}
            onChange={setDays}
            options={[
              { id: "7", label: "7 days" },
              { id: "30", label: "30 days" },
              { id: "90", label: "90 days" },
            ]}
          />
        </div>
      </div>
      <Checkbox label="Put new alerts on this number at the top of my queue" checked={top} onChange={(e) => setTop(e.target.checked)} />
      <Checkbox label="Share with my team’s watchlist" checked={shared} onChange={(e) => setShared(e.target.checked)} />
      <RequestError error={failure} />
    </Modal>
  );
}
