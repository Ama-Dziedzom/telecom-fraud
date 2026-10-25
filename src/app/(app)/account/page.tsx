"use client";

import { AccountFrame } from "@/components/account/AccountFrame";
import { Card, Skeleton } from "@/components/app/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { useRef, useState } from "react";

type Profile = { display_name: string; callback_phone: string; managed: Array<[string, string]>; it_admin: string };

/** I6 · Account · profile. */
export default function ProfilePage() {
  const toast = useToast();
  // TODO(api): proposed GET/PATCH /me/profile (display name, call-back phone, photo).
  const { data } = useApi<Profile>("/me/profile");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const initials = (name ?? data?.display_name ?? "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch("PATCH", "/me/profile", { display_name: name ?? data?.display_name, callback_phone: phone ?? data?.callback_phone });
      toast({ tone: "success", title: "Profile saved" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountFrame>
      <div className="flex items-start gap-4">
        <Card title="Your details" icon="app/icon-user-secondary-18" className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-brand-primary-subtle text-h3 text-text-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials}
            </span>
            <span className="flex flex-col gap-1">
              <Button variant="secondary" size="sm" onClick={() => file.current?.click()} iconLeft={<Icon name="app/icon-plus-primary-16" size={14} />}>
                Upload photo
              </Button>
              <span className="text-caption text-text-tertiary">JPG or PNG · up to 2 MB</span>
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
            <div className="flex gap-4">
              <TextField size="lg" label="Display name" value={name ?? data.display_name} onChange={(e) => setName(e.target.value)} />
              <TextField size="lg" mono label="Phone for call-backs" value={phone ?? data.callback_phone} onChange={(e) => setPhone(e.target.value)} hint="Only your supervisor sees this." />
            </div>
          )}
        </Card>
        <Card title="Managed by IT" icon="icon-lock-secondary-16" className="w-[460px] shrink-0">
          <dl className="flex flex-col">
            {data?.managed.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border-subtle py-3 text-body-s last:border-b-0">
                <dt className="text-text-secondary">{k}</dt>
                <dd className="flex items-center gap-1.5 text-text-primary">
                  {v}
                  <Icon name="icon-lock-secondary-16" size={12} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-text-tertiary">To change these, ask {data?.it_admin}.</p>
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
