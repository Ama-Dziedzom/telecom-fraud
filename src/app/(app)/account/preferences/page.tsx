"use client";

import { AccountFrame } from "@/components/account/AccountFrame";
import { Card, Skeleton } from "@/components/app/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { useState, type ReactNode } from "react";

type Prefs = { start_page: string; density: "comfortable" | "compact"; time_format: "24h" | "12h"; language: string; money_format: string; critical_sound: boolean };

function Row({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-subtle py-3.5 last:border-b-0">
      <span className="flex flex-col">
        <span className="text-body-m font-medium text-text-primary">{title}</span>
        <span className="text-caption text-text-secondary">{detail}</span>
      </span>
      {children}
    </div>
  );
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="relative flex h-10 w-[240px] items-center rounded-lg border border-border-default bg-surface-base pr-8 pl-3 focus-within:border-border-focus focus-within:shadow-focus">
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

/** I10 · Account · preferences. */
export default function PreferencesPage() {
  const toast = useToast();
  // TODO(api): proposed GET/PATCH /me/preferences.
  const { data } = useApi<Prefs>("/me/preferences");
  const [edits, setEdits] = useState<Partial<Prefs>>({});
  const [busy, setBusy] = useState(false);
  const p = data ? { ...data, ...edits } : null;
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setEdits((e) => ({ ...e, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch("PATCH", "/me/preferences", edits);
      toast({ tone: "success", title: "Preferences saved" });
      setEdits({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountFrame>
      <Card title="Preferences" icon="app/icon-sliders-18">
        {!p ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <div className="flex flex-col">
            <Row title="Start page" detail="Where you land after signing in">
              <Pick
                label="Start page"
                value={p.start_page}
                onChange={(v) => set("start_page", v)}
                options={[
                  ["/queue", "My queue"],
                  ["/alerts", "Live alerts"],
                  ["/cases", "Cases"],
                  ["/overview", "Overview"],
                ]}
              />
            </Row>
            <Row title="Table density" detail="Comfortable shows more context per row">
              <Segmented
                label="Table density"
                value={p.density}
                onChange={(v) => set("density", v)}
                options={[
                  { id: "comfortable", label: "Comfortable" },
                  { id: "compact", label: "Compact" },
                ]}
              />
            </Row>
            <Row title="Time format" detail="Used everywhere, including exports">
              <Segmented
                label="Time format"
                value={p.time_format}
                onChange={(v) => set("time_format", v)}
                options={[
                  { id: "24h", label: "24-hour" },
                  { id: "12h", label: "12-hour" },
                ]}
              />
            </Row>
            <Row title="Language" detail="Twi and Ewe coming soon">
              <Pick label="Language" value={p.language} onChange={(v) => set("language", v)} options={[["en-GH", "English (Ghana)"]]} />
            </Row>
            <Row title="Show amounts as" detail="Currency for all money values">
              <Pick
                label="Show amounts as"
                value={p.money_format}
                onChange={(v) => set("money_format", v)}
                options={[
                  ["GHS 18,400.00", "GHS 18,400.00"],
                  ["GH₵ 18,400.00", "GH₵ 18,400.00"],
                ]}
              />
            </Row>
            <Row title="Sound for critical alerts" detail="Plays once when a 90+ alert arrives">
              <span className="relative flex h-5 w-9 shrink-0">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Sound for critical alerts"
                  checked={p.critical_sound}
                  onChange={(e) => set("critical_sound", e.target.checked)}
                  className="peer h-5 w-9 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors checked:bg-brand-primary focus-visible:shadow-focus"
                />
                <span className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-surface-base shadow-sm transition-transform peer-checked:translate-x-4" />
              </span>
            </Row>
          </div>
        )}
      </Card>
      <div className="flex justify-end">
        <Button size="md" onClick={save} loading={busy} disabled={!Object.keys(edits).length}>
          Save changes
        </Button>
      </div>
    </AccountFrame>
  );
}
