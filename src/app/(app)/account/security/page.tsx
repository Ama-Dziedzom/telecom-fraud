"use client";

import { AccountFrame } from "@/components/account/AccountFrame";
import { Card, Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Session = { id: string; device: string; kind: "desktop" | "phone"; location: string; last_active: string | null; current: boolean };
type Security = {
  password: { changed_days_ago: number; rotate_days: number };
  two_step: { status: string; required: boolean };
  authenticators: Array<{ id: string; name: string; primary: boolean; added: string; last_used: string }>;
  recovery_codes: { left: number; total: number; generated: string };
  sessions: Session[];
  sign_in: Array<[string, string]>;
  it_admin: string;
};

/** I7/I8 · Account · security — password, two-step, where you’re signed in. */
export default function SecurityPage() {
  const toast = useToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  // TODO(api): proposed GET /me/security, DELETE /me/sessions, DELETE /me/sessions/{id}.
  const { data } = useApi<Security>("/me/security");
  const [confirm, setConfirm] = useState(false);
  const [changeNext, setChangeNext] = useState(true);
  const [busy, setBusy] = useState(false);
  const others = data?.sessions.filter((s) => !s.current) ?? [];

  const signOutOthers = async () => {
    setBusy(true);
    try {
      await apiFetch("DELETE", "/me/sessions", { change_password_next: changeNext });
      await mutate("/me/security");
      setConfirm(false);
      toast({ tone: "success", title: `Signed out ${others.length} other ${others.length === 1 ? "session" : "sessions"}`, body: "Recorded in the audit log." });
      if (changeNext) router.push("/forgot-password");
    } finally {
      setBusy(false);
    }
  };
  const signOutOne = async (s: Session) => {
    await apiFetch("DELETE", `/me/sessions/${s.id}`);
    await mutate("/me/security");
    toast({ tone: "success", title: `Signed out ${s.device}` });
  };

  return (
    <AccountFrame>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card title="Password" icon="app/icon-lock-secondary-18">
            <div className="flex items-center justify-between">
              <span className="flex flex-col">
                <span className="text-body-m text-text-primary">{data ? `Last changed ${data.password.changed_days_ago} days ago` : "…"}</span>
                <span className="text-caption text-text-secondary">Kasa Mobile requires a change every {data?.password.rotate_days ?? 90} days.</span>
              </span>
              <ButtonLink href="/forgot-password" variant="secondary" size="md">
                Change password
              </ButtonLink>
            </div>
          </Card>
          <Card title="Two-step verification" icon="app/icon-shield-check-secondary-18" aside={data ? <Badge label={`On${data.two_step.required ? " · required" : ""}`} tone="success" dot /> : undefined}>
            {!data ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <ul className="flex flex-col">
                  {data.authenticators.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 border-b border-border-subtle py-3">
                      <span className="flex size-9 items-center justify-center rounded-[10px] bg-surface-sunken">
                        <Icon name="app/icon-phone-secondary-18" size={18} />
                      </span>
                      <span className="flex flex-col">
                        <span className="flex items-center gap-2 text-body-m font-medium text-text-primary">
                          {a.name}
                          {a.primary && <Badge label="Primary" tone="success" />}
                        </span>
                        <span className="text-caption text-text-secondary">
                          Added {a.added} · used {a.last_used}
                        </span>
                      </span>
                      <span className="flex-1" />
                      {/* TODO(api): proposed PATCH/DELETE /me/authenticators/{id}. */}
                      <Button variant="ghost" size="sm" onClick={() => toast({ title: a.primary ? "Renaming isn’t available yet" : "Removing needs a step-up", body: "Ask your IT admin for now." })}>
                        {a.primary ? "Rename" : "Remove"}
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 rounded-[10px] bg-surface-raised px-3.5 py-3">
                  <Icon name="app/icon-key-secondary-18" size={18} />
                  <span className="flex flex-1 flex-col">
                    <span className="text-label-m text-text-primary">Recovery codes</span>
                    <span className="text-caption text-text-secondary">
                      {data.recovery_codes.left} of {data.recovery_codes.total} left · generated {data.recovery_codes.generated}
                    </span>
                  </span>
                  <ButtonLink href="/sign-in/backup-codes" variant="secondary" size="sm">
                    View / regenerate
                  </ButtonLink>
                </div>
                <ButtonLink href="/sign-in/set-up-authenticator" variant="secondary" size="sm" iconLeft={<Icon name="app/icon-plus-primary-16" size={14} />}>
                  Add authenticator
                </ButtonLink>
              </>
            )}
          </Card>
          <Card
            title="Where you’re signed in"
            icon="app/icon-laptop-secondary-18"
            aside={
              <Button variant="secondary" size="sm" disabled={!others.length} onClick={() => setConfirm(true)} iconLeft={<Icon name="app/icon-logout-primary-16" size={14} />}>
                Sign out all other sessions
              </Button>
            }
          >
            <div className="overflow-hidden rounded-xl border border-border-subtle">
              <table className="w-full text-left">
                <thead className="border-b border-border-subtle bg-surface-raised">
                  <tr className="text-overline text-text-tertiary uppercase">
                    <th className="py-[11px] pl-5 font-bold">Device</th>
                    <th className="w-[200px] py-[11px] font-bold">Location</th>
                    <th className="w-[150px] py-[11px] font-bold">Last active</th>
                    <th className="w-[110px] py-[11px] pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {data?.sessions.map((s) => (
                    <tr key={s.id} className="border-b border-border-subtle last:border-b-0">
                      <td className="py-2.5 pl-5">
                        <span className="flex items-center gap-2.5 text-body-m font-medium text-text-primary">
                          <Icon name={s.kind === "desktop" ? "app/icon-laptop-secondary-16-b" : "app/icon-phone-secondary-16"} size={16} />
                          {s.device}
                          {s.current ? " · this device" : ""}
                        </span>
                      </td>
                      <td className="py-2.5 text-body-s text-text-secondary">{s.location}</td>
                      <td className="py-2.5 text-body-s text-text-secondary">{s.current ? <Badge label="This session" tone="success" dot /> : s.last_active}</td>
                      <td className="py-2.5 pr-5 text-right">
                        {!s.current && (
                          <Button variant="ghost" size="sm" onClick={() => signOutOne(s)}>
                            Sign out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Card title="Sign-in method" icon="app/icon-info-secondary-18" className="w-[400px] shrink-0">
          <dl className="flex flex-col">
            {data?.sign_in.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border-subtle py-[9px] last:border-b-0">
                <dt className="text-body-s text-text-secondary">{k}</dt>
                <dd className="text-body-m font-medium text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-text-secondary">Some settings are managed by your IT admin, {data?.it_admin}.</p>
        </Card>
      </div>

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(false)}
          width={520}
          icon="app/icon-logout-brand-22"
          tone="brand"
          title={`Sign out ${others.length} other ${others.length === 1 ? "session" : "sessions"}?`}
          description={`${others.map((s) => `${s.device} (${s.location.split(" ·")[0]})`).join(" and ")} will be signed out immediately. You’ll stay signed in here.`}
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button size="md" loading={busy} onClick={signOutOthers} iconLeft={<Icon name="app/icon-logout-white-16" size={16} />}>
                Sign out {others.length} {others.length === 1 ? "session" : "sessions"}
              </Button>
            </>
          }
        >
          <Banner tone="warning" title="Don’t recognise one of them?">
            Change your password too, and tell your IT admin ({data?.it_admin}). We’ll record this in the audit log.
          </Banner>
          <Checkbox label="Also change my password next" checked={changeNext} onChange={(e) => setChangeNext(e.target.checked)} />
        </Modal>
      )}
    </AccountFrame>
  );
}
