"use client";

import { AccountFrame } from "@/components/account/AccountFrame";
import { Card, Skeleton } from "@/components/app/Card";
import { useStepUp } from "@/components/app/StepUp";
import { RequestError } from "@/components/auth/RequestError";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isProblem } from "@/lib/api/client";
import { useApi, type PersonRef } from "@/lib/api/fd";
import { formatClock, formatDate, TZ, useNow } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Session = { id: string; device: string; kind: "desktop" | "phone" | "tablet"; place: string; ip_masked: string; last_active_at: string; current: boolean };
type Authenticator = { id: string; name: string; primary: boolean; added_at: string; last_used_at: string | null };
type Security = {
  password: { changed_at: string; rotate_days: number; expires_at: string };
  two_step: { status: string; required: boolean };
  authenticators: Authenticator[];
  recovery_codes: { left: number; total: number; generated_at: string };
  sessions: Session[];
  sign_in: { email: string; method: string; sso_enabled: boolean; idle_timeout_minutes: number; timeout_set_by: string };
  it_admin: PersonRef;
};

const METHOD: Record<string, string> = { password_totp: "Password + authenticator", password: "Password", sso: "Company SSO" };
const SET_BY: Record<string, string> = { it_admin: "IT", operator: "Kasa Mobile" };

const DAY = 86_400_000;
const dayOf = (t: string | number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
/** today 08:02 · 9 days ago */
const usedWhen = (iso: string, now: number) => (dayOf(iso) === dayOf(now) ? `today ${formatClock(iso)}` : `${Math.max(1, Math.round((now - Date.parse(iso)) / DAY))} days ago`);
/** 5 minutes ago · 2 hours ago · 9 days ago */
function activeWhen(iso: string, now: number) {
  const mins = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** I7/I8 · Account · security — password, two-step, where you’re signed in. */
export default function SecurityPage() {
  const toast = useToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const stepUp = useStepUp();
  const now = useNow();
  const { data } = useApi<Security>("/me/security");
  const [confirm, setConfirm] = useState(false);
  const [changeNext, setChangeNext] = useState(true);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Authenticator | null>(null);
  const [newName, setNewName] = useState("");
  const [removing, setRemoving] = useState<Authenticator | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const others = data?.sessions.filter((s) => !s.current) ?? [];
  const changedDays = data ? Math.floor((now - Date.parse(data.password.changed_at)) / DAY) : null;
  const signIn = data
    ? [
        ["Email", data.sign_in.email],
        ["Method", METHOD[data.sign_in.method] ?? data.sign_in.method],
        ["SSO", data.sign_in.sso_enabled ? "Enabled" : "Not enabled for Kasa Mobile"],
        ["Session timeout", `${data.sign_in.idle_timeout_minutes} min idle · set by ${SET_BY[data.sign_in.timeout_set_by] ?? "IT"}`],
      ]
    : [];

  const signOutOthers = async () => {
    setBusy(true);
    try {
      const res = await stepUp(() =>
        apiFetch<{ signed_out: number }>("DELETE", `/me/sessions${changeNext ? "?change_password_next=true" : ""}`),
      );
      await mutate("/me/security");
      setConfirm(false);
      toast({ tone: "success", title: `Signed out ${res.signed_out} other ${res.signed_out === 1 ? "session" : "sessions"}`, body: "Recorded in the audit log." });
      if (changeNext) router.push("/forgot-password");
    } catch {
      // Step-up cancelled: keep the dialog open.
    } finally {
      setBusy(false);
    }
  };
  const signOutOne = async (s: Session) => {
    try {
      await apiFetch("DELETE", `/me/sessions/${s.id}`);
    } catch (err) {
      if (!isProblem(err, "current_session")) throw err;
      return toast({ title: "That’s this session", body: "Use Sign out to end the session you’re using." });
    }
    await mutate("/me/security");
    toast({ tone: "success", title: `Signed out ${s.device}` });
  };
  const rename = async () => {
    if (!renaming || !newName.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      await apiFetch("PATCH", `/me/authenticators/${renaming.id}`, { name: newName.trim() });
      await mutate("/me/security");
      setRenaming(null);
      toast({ tone: "success", title: "Authenticator renamed" });
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setFailure(null);
    try {
      await stepUp(() => apiFetch("DELETE", `/me/authenticators/${removing.id}`));
      await mutate("/me/security");
      setRemoving(null);
      toast({ tone: "success", title: `Removed ${removing.name}`, body: "Recorded in the audit log." });
    } catch (err) {
      // 409 last_authenticator shows in the dialog; a cancelled step-up just leaves it open.
      if (isProblem(err, "last_authenticator")) setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountFrame>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card title="Password" icon="app/icon-lock-secondary-18">
            <div className="flex items-center justify-between">
              <span className="flex flex-col">
                <span className="text-body-m text-text-primary">{changedDays !== null ? `Last changed ${changedDays} days ago` : "…"}</span>
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
                          Added {formatDate(a.added_at)}
                          {a.last_used_at && ` · used ${usedWhen(a.last_used_at, now)}`}
                        </span>
                      </span>
                      <span className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFailure(null);
                          if (a.primary) {
                            setNewName(a.name);
                            setRenaming(a);
                          } else setRemoving(a);
                        }}
                      >
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
                      {data.recovery_codes.left} of {data.recovery_codes.total} left · generated {formatDate(data.recovery_codes.generated_at)}
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
                      <td className="py-2.5 text-body-s text-text-secondary">
                        {s.place} · {s.ip_masked}
                      </td>
                      <td className="py-2.5 text-body-s text-text-secondary">{s.current ? <Badge label="This session" tone="success" dot /> : activeWhen(s.last_active_at, now)}</td>
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
            {signIn.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border-subtle py-[9px] last:border-b-0">
                <dt className="text-body-s text-text-secondary">{k}</dt>
                <dd className="text-body-m font-medium text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-text-secondary">Some settings are managed by your IT admin, {data?.it_admin.name}.</p>
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
          description={`${others.map((s) => `${s.device} (${s.place})`).join(" and ")} will be signed out immediately. You’ll stay signed in here.`}
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
            Change your password too, and tell your IT admin ({data?.it_admin.name}). We’ll record this in the audit log.
          </Banner>
          <Checkbox label="Also change my password next" checked={changeNext} onChange={(e) => setChangeNext(e.target.checked)} />
        </Modal>
      )}

      {renaming && (
        <Modal
          open
          onClose={() => setRenaming(null)}
          icon="app/icon-phone-secondary-18"
          tone="neutral"
          title="Rename authenticator"
          description="The name only helps you tell your devices apart."
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button size="md" loading={busy} disabled={!newName.trim() || newName.trim() === renaming.name} onClick={rename}>
                Save
              </Button>
            </>
          }
        >
          <TextField size="lg" label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <RequestError error={failure} />
        </Modal>
      )}

      {removing && (
        <Modal
          open
          onClose={() => setRemoving(null)}
          icon="icon-alert-triangle-critical-24"
          tone="critical"
          title={`Remove ${removing.name}?`}
          description="You won’t be able to sign in with it any more. Kasa Mobile requires two-step sign-in, so keep at least one."
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="md" loading={busy} onClick={remove}>
                Remove
              </Button>
            </>
          }
        >
          <RequestError error={failure} />
        </Modal>
      )}
    </AccountFrame>
  );
}
