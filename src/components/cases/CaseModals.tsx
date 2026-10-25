"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Button } from "@/components/ui/Button";
import { Checkbox, OptionCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, Select, TextArea, TextField } from "@/components/ui/TextField";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type SearchHit = { id: string; kind: string; title: string; subtitle: string; open_cases: number };

const REPORTED = [
  ["care_100", "Customer called care (100)"],
  ["branch", "Walked into a branch"],
  ["agent", "Reported by an agent"],
  ["police", "Police or regulator request"],
  ["internal", "Spotted by a colleague"],
] as const;

const FRAUD_TYPES = [
  ["social_engineering", "MoMo scam · social engineering"],
  ["sim_swap_to_momo", "SIM swap to MoMo"],
  ["account_takeover", "Account takeover"],
  ["agent_cash_out", "Agent cash-out"],
  ["sim_box_bypass", "Bypass (SIM box)"],
  ["wangiri", "Wangiri"],
] as const;

/** G10 · New case — opened by hand from a report; the subscriber is looked up as you type. */
export function NewCaseModal({ initialNumber = "", onClose }: { initialNumber?: string; onClose: () => void }) {
  const router = useRouter();
  const [number, setNumber] = useState(initialNumber);
  const [reported, setReported] = useState<string>(REPORTED[0][0]);
  const [fraudType, setFraudType] = useState<string>(FRAUD_TYPES[0][0]);
  const [what, setWhat] = useState("");
  const [reference, setReference] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const digits = number.replace(/\D/g, "");
  const { data: found } = useApi<{ data: SearchHit[] }>(digits.length >= 9 ? `/search?q=${encodeURIComponent(number)}&type=msisdn` : null);
  const hit = found?.data.find((h) => h.kind === "subscriber");

  const create = async () => {
    setTried(true);
    if (digits.length < 9 || what.trim().length < 10) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await apiFetch<{ id: string }>("POST", "/cases", {
        title: FRAUD_TYPES.find(([id]) => id === fraudType)?.[1],
        stage: "investigate",
        fraud_type: fraudType,
        subjects: hit ? [hit.id] : [number],
        note: what,
        // Proposed: how it was reported, and the reporter’s reference.
        reported_via: reported,
        reference: reference || undefined,
      });
      router.push(`/cases/${res.id}`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title="New case"
      description="Opened by you · assigned to you"
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={create} loading={busy} iconLeft={<Icon name="app/icon-plus-white-18" size={18} />}>
            Create case
          </Button>
        </>
      }
    >
      <TextField
        size="lg"
        mono
        label="Subscriber number"
        required
        inputMode="tel"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="+233 24 123 4567"
        iconLeft={<Icon name="app/icon-phone-18" size={18} />}
        error={tried && digits.length < 9 ? "Enter the full number." : undefined}
      />
      {hit && (
        <div className="flex items-center gap-3 rounded-[10px] border border-success-border bg-success-bg px-4 py-3">
          <Icon name="app/icon-check-circle-success-22" size={20} />
          <span className="flex flex-col">
            <span className="text-label-m text-text-primary">Subscriber found · {hit.title.replace(/^\+[\d *]+/, "").trim() || hit.title} (masked)</span>
            <span className="text-caption text-text-secondary">
              {hit.subtitle}
              {hit.open_cases ? ` · ${hit.open_cases} open ${hit.open_cases === 1 ? "case" : "cases"}` : ""}
            </span>
          </span>
        </div>
      )}
      <div className="flex gap-4">
        <Select label="How was it reported?" required value={reported} onChange={(e) => setReported(e.target.value)}>
          {REPORTED.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </Select>
        <Select label="Fraud type" required value={fraudType} onChange={(e) => setFraudType(e.target.value)}>
          {FRAUD_TYPES.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </Select>
      </div>
      <TextArea
        label="What happened?"
        required
        rows={2}
        value={what}
        onChange={(e) => setWhat(e.target.value)}
        error={tried && what.trim().length < 10 ? "Say what the reporter told you." : undefined}
      />
      <TextField
        size="lg"
        label={
          <>
            Reference from the reporter <span className="text-caption font-normal text-text-tertiary">optional</span>
          </>
        }
        value={reference} onChange={(e) => setReference(e.target.value)} />
      <RequestError error={failure} />
    </Modal>
  );
}

const LOOK_AT = [
  { id: "agents", icon: "app/icon-building-brand-24", title: "Agents", detail: "Who does SIM swaps and cash-outs" },
  { id: "wallets", icon: "app/icon-wallet-16", title: "Wallets", detail: "MoMo accounts" },
  { id: "sims", icon: "app/icon-sim-18", title: "SIMs", detail: "Numbers and SIM cards" },
  { id: "devices", icon: "app/icon-phone-18", title: "Devices", detail: "By IMEI" },
] as const;

/** G11 · Start a prospect — a hunch and a rule, with a live count of what matches. */
export function ProspectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [hunch, setHunch] = useState("");
  const [lookAt, setLookAt] = useState<string>("agents");
  const [rule, setRule] = useState({ metric: "SIM swaps per day", op: "more than 5", area: "Kasoa", period: "last 14 days" });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  // TODO(api): proposed GET /prospects/preview.
  const { data: preview } = useApi<{ matches: number }>(`/prospects/preview?look_at=${lookAt}&area=${encodeURIComponent(rule.area)}`);
  const noun = LOOK_AT.find((l) => l.id === lookAt)!.title.toLowerCase();

  const start = async () => {
    setBusy(true);
    setFailure(null);
    try {
      // TODO(api): proposed POST /prospects (the collection only has POST /cases with stage=prospect).
      const res = await apiFetch<{ id: string }>("POST", "/prospects", { hunch: hunch || "Untitled hunch", look_at: lookAt, rule });
      router.push(`/prospect/${res.id}`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  };

  const Chip = ({ field, mono = true }: { field: keyof typeof rule; mono?: boolean }) => (
    <input
      aria-label={field}
      value={rule[field]}
      onChange={(e) => setRule((r) => ({ ...r, [field]: e.target.value }))}
      size={Math.max(4, rule[field].length)}
      className={cn("h-7 rounded-full border border-border-default bg-surface-base px-2.5 text-text-primary", mono ? "font-mono text-mono-s" : "text-body-s")}
    />
  );

  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title={
        <span className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary-subtle">
            <Icon name="app/icon-search-brand-20" size={20} />
          </span>
          <span className="flex flex-col gap-1">
            Start a prospect
            <span className="text-body-m font-normal text-text-secondary">Hunt for fraud before an alert fires. Nothing changes for customers while you look.</span>
          </span>
        </span>
      }
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={start} loading={busy} disabled={!hunch.trim()} iconLeft={<Icon name="app/icon-arrow-right-white-16" size={18} />}>
            Start prospect
          </Button>
        </>
      }
    >
      <TextField size="lg" label="What’s your hunch?" value={hunch} onChange={(e) => setHunch(e.target.value)} placeholder="Kasoa agents doing far more SIM swaps than usual" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>Look at</FieldLabel>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {LOOK_AT.map((l) => (
            <label
              key={l.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5",
                lookAt === l.id ? "border-[1.5px] border-brand-primary bg-brand-primary-subtle" : "border-border-default",
              )}
            >
              <Icon name={l.icon} size={20} />
              <span className="flex flex-1 flex-col">
                <span className="text-body-m text-text-primary">{l.title}</span>
                <span className="text-caption text-text-secondary">{l.detail}</span>
              </span>
              <input
                type="radio"
                name="look_at"
                checked={lookAt === l.id}
                onChange={() => setLookAt(l.id)}
                className="size-[18px] cursor-pointer appearance-none rounded-full border-[1.25px] border-border-strong checked:border-[5px] checked:border-brand-primary"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <FieldLabel>Find ones where</FieldLabel>
        {(
          [
            ["When", "metric", "op"],
            ["And", "Area", "area"],
            ["And", "Period", "period"],
          ] as const
        ).map(([joiner, a, b], i) => (
          <div key={i} className="flex w-fit items-center gap-2 rounded-lg bg-surface-sunken px-2.5 py-1.5 text-body-s text-text-primary">
            <span className="text-overline text-text-brand uppercase">{joiner}</span>
            {i === 0 ? rule.metric : a}
            <Chip field={b} />
          </div>
        ))}
      </div>
      <p className="flex items-center gap-2 rounded-[10px] bg-brand-primary-subtle px-3.5 py-3 text-label-m text-text-brand" aria-live="polite">
        <Icon name="app/icon-search-brand-20" size={16} />
        {preview ? `${preview.matches} ${preview.matches === 1 ? noun.replace(/s$/, "") : noun} match right now` : "Counting matches…"}
      </p>
      <RequestError error={failure} />
    </Modal>
  );
}

/** G5 · Save this view. */
export function SaveViewModal({ summary, filters, onClose }: { summary: string; filters: Record<string, unknown>; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [byDefault, setByDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      // TODO(api): proposed POST /views.
      await apiFetch("POST", "/views", { name, shared, default: byDefault, filters });
      await mutate("/views");
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
      width={520}
      icon="app/icon-sliders-brand-22"
      tone="brand"
      title="Save this view"
      description={summary || "Current filters"}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={save} loading={busy} disabled={!name.trim()}>
            Save view
          </Button>
        </>
      }
    >
      <TextField size="lg" label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="High-risk SIM swaps · Ashanti" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>Who can use it</FieldLabel>
        </legend>
        <OptionCard name="shared" checked={!shared} onChange={() => setShared(false)} title="Only me" />
        <OptionCard name="shared" checked={shared} onChange={() => setShared(true)} title="My team" description="Kasa Mobile fraud team" />
      </fieldset>
      <Checkbox label="Open Cases with this view by default" checked={byDefault} onChange={(e) => setByDefault(e.target.checked)} />
      <RequestError error={failure} />
    </Modal>
  );
}
