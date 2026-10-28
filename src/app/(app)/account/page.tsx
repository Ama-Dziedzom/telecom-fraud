"use client";

import { AccountFrame, SettingsList } from "@/components/account/AccountFrame";
import { Card, Skeleton } from "@/components/app/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi, type PersonRef } from "@/lib/api/fd";
import { roleLabel } from "@/lib/auth/api";
import { useRef, useState } from "react";

type Profile = {
  display_name: string;
  callback_phone: string;
  /** Set by IT; read-only here. */
  managed: { email: string; role: string; team: { id: string; name: string }; supervisor: PersonRef; it_admin: PersonRef };
};

/** I6 · Account · profile. */
export default function ProfilePage() {
  const toast = useToast();
  // TODO(api): no photo upload endpoint yet; the photo stays on this page.
  const { data } = useApi<Profile>("/me/profile");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const managed: Array<[string, string]> = data
    ? [
        ["Work email", data.managed.email],
        ["Role", roleLabel(data.managed.role)],
        // “Fraud, Kumasi” reads as “Fraud · Kumasi”.
        ["Team", data.managed.team.name.replace(/, /g, " · ")],
        ["Supervisor", data.managed.supervisor.name],
      ]
    : [];
  const initials = (name ?? data?.display_name ?? "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch("PATCH", "/me/profile", { display_name: name ?? data?.display_name, callback_phone: phone ?? data?.callback_phone });
      toast({ tone: "success", title: "Saved", body: "Your profile is up to date." });
      setName(null);
      setPhone(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountFrame>
      <div className="flex items-start gap-6">
        <Card title="Your details" className="min-w-0 flex-1">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-primary-subtle text-label-s text-text-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials}
            </span>
            <span className="flex flex-col items-start gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => file.current?.click()}>
                Upload photo
              </Button>
              <span className="text-caption text-text-secondary">JPG or PNG, up to 2 MB</span>
            </span>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) return toast({ title: "That photo is over 2 MB", body: "Pick a smaller JPG or PNG." });
                setPhoto(URL.createObjectURL(f));
              }}
            />
          </div>
          {!data ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-start gap-4">
              <TextField size="md" label="Display name" value={name ?? data.display_name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
              <TextField
                size="md"
                label="Phone for call-backs"
                value={phone ?? data.callback_phone}
                onChange={(e) => setPhone(e.target.value)}
                hint="Only your supervisor sees this."
                className="min-w-0 flex-1"
              />
            </div>
          )}
        </Card>
        <Card title="Managed by IT" className="w-[360px] shrink-0">
          {!data ? <Skeleton className="h-32 w-full" /> : <SettingsList rows={managed} />}
          <p className="-mt-2 text-caption text-text-secondary">
            To change these, ask {data ? `${data.managed.it_admin.name} (IT admin)` : "your IT admin"}.
          </p>
        </Card>
      </div>
      <div className="flex justify-end">
        <Button size="md" onClick={save} loading={busy} disabled={name === null && phone === null && !photo}>
          Save changes
        </Button>
      </div>
    </AccountFrame>
  );
}
