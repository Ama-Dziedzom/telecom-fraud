"use client";

import { AccountFrame, SettingRow } from "@/components/account/AccountFrame";
import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { Chips } from "@/components/shell/Chips";
import { Select } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { useState } from "react";

type Prefs = {
  start_page: "queue" | "alerts" | "cases" | "overview";
  density: "comfortable" | "compact";
  time_format: "24h" | "12h";
  locale: string;
  money_format: "code" | "symbol";
  critical_sound: boolean;
};

const START: Array<[Prefs["start_page"], string]> = [
  ["queue", "My queue"],
  ["alerts", "Live alerts"],
  ["cases", "Cases"],
  ["overview", "Overview"],
];
const MONEY: Array<[Prefs["money_format"], string]> = [
  ["code", "GHS 18,400.00"],
  ["symbol", "GH₵ 18,400.00"],
];

/** Select, 40 high and 220 wide, for a setting row. */
function Pick<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className="w-[220px] shrink-0">
      {options.map(([id, text]) => (
        <option key={id} value={id}>
          {text}
        </option>
      ))}
    </Select>
  );
}

/** I10 · Account · preferences — saves as you go. */
export default function PreferencesPage() {
  const toast = useToast();
  const { data } = useApi<Prefs>("/me/preferences");
  const [edits, setEdits] = useState<Partial<Prefs>>({});
  const p = data ? { ...data, ...edits } : null;

  /** PATCH one setting; put it back if the server says no. */
  const set = async <K extends keyof Prefs>(k: K, v: Prefs[K], done: string) => {
    const before = edits[k];
    setEdits((e) => ({ ...e, [k]: v }));
    try {
      await apiFetch("PATCH", "/me/preferences", { [k]: v });
      toast({ tone: "success", title: "Saved", body: done });
    } catch {
      setEdits((e) => ({ ...e, [k]: before }));
      toast({ title: "Couldn’t save that change", body: "Check your connection and try again." });
    }
  };

  return (
    <AccountFrame>
      <Card title="Preferences" aside={<CardMeta>Changes save as you go</CardMeta>}>
        {!p ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <div className="flex flex-col">
            <SettingRow title="Start page" detail="Where you land after signing in">
              <Pick
                label="Start page"
                value={p.start_page}
                options={START}
                onChange={(v) => void set("start_page", v, `You’ll start on ${START.find(([id]) => id === v)?.[1]}.`)}
              />
            </SettingRow>
            <SettingRow title="Table density" detail="Comfortable shows more context per row">
              <Chips
                mode="choice"
                label="Table density"
                value={p.density}
                onChange={(v) => void set("density", v, `Tables are now ${v}.`)}
                options={[
                  { id: "comfortable", label: "Comfortable" },
                  { id: "compact", label: "Compact" },
                ]}
              />
            </SettingRow>
            <SettingRow title="Time format" detail="Used everywhere, including reports">
              <Chips
                mode="choice"
                label="Time format"
                value={p.time_format}
                onChange={(v) => void set("time_format", v, `Times now show in ${v === "24h" ? "24" : "12"}-hour format.`)}
                options={[
                  { id: "24h", label: "24-hour" },
                  { id: "12h", label: "12-hour" },
                ]}
              />
            </SettingRow>
            <SettingRow title="Language" detail="Twi and Ewe coming soon">
              <Pick label="Language" value={p.locale} options={[["en-GH", "English (Ghana)"]]} onChange={(v) => void set("locale", v, "Language saved.")} />
            </SettingRow>
            <SettingRow title="Show amounts as" detail="Format for all money values">
              <Pick
                label="Show amounts as"
                value={p.money_format}
                options={MONEY}
                onChange={(v) => void set("money_format", v, `Amounts now show as ${MONEY.find(([id]) => id === v)?.[1]}.`)}
              />
            </SettingRow>
            <SettingRow title="Sound for critical alerts" detail="Plays once when a 90+ alert arrives">
              <Toggle
                label={<span className="sr-only">Sound for critical alerts</span>}
                checked={p.critical_sound}
                onChange={(e) => void set("critical_sound", e.target.checked, e.target.checked ? "Critical alerts play a sound." : "Critical alerts are silent.")}
                className="gap-0"
              />
            </SettingRow>
          </div>
        )}
      </Card>
    </AccountFrame>
  );
}
