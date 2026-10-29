"use client";

import { AccountFrame, SettingsList } from "@/components/account/AccountFrame";
import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { useStepUp } from "@/components/app/StepUp";
import { RequestError } from "@/components/auth/RequestError";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckCard } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isProblem } from "@/lib/api/client";
import { useApi, type PersonRef } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
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

const METHOD: Record<string, string> = { password_totp: "Password and authenticator", password: "Password", sso: "Company SSO" };
const SET_BY: Record<string, string> = { it_admin: "IT", operator: "MTN Ghana" };

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

/** I7/I8 · Account · security — password, two-step, where you’re signed in; sign out the others. */
export default function SecurityPage() {
  const toast = useToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const stepUp = useStepUp();
  const now = useNow();
  const operator = useOperatorName() ?? "MTN Ghana";
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
        ["SSO", data.sign_in.sso_enabled ? "Enabled" : `Not enabled for ${operator}`],
        ["Session timeout", `${data.sign_in.idle_timeout_minutes} min idle · set by ${data.sign_in.timeout_set_by === "operator" ? operator : (SET_BY[data.sign_in.timeout_set_by] ?? "IT")}`],
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

  const th = "h-10 px-4 text-caption font-normal text-text-secondary";
  return (
    <AccountFrame>
      <div className="flex items-start gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Card title="Password">
            <div className="flex items-center justify-between gap-4">
              <span className="flex flex-col gap-0.5">
                <span className="text-label-s text-text-primary">{changedDays !== null ? `Last changed ${changedDays} days ago` : "…"}</span>
                <span className="text-caption text-text-secondary">
                  {operator} requires a change every {data?.password.rotate_days ?? 90} days.
                </span>
              </span>
              <ButtonLink href="/forgot-password" variant="secondary" size="md">
                Change password
              </ButtonLink>
            </div>
          </Card>

          <Card
            title="Two-step verification"
            aside={data && <CardMeta>{data.two_step.required ? `On · required by ${operator}` : "On"}</CardMeta>}
          >
            {!data ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <ul className="-mt-1 flex flex-col">
                  {data.authenticators.map((a) => (
                    <li key={a.id} className="flex min-h-12 items-center gap-3 border-b border-border-default py-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-label-s text-text-primary">{a.name}</span>
                        <span className="text-caption text-text-secondary">
                          Added {formatDate(a.added_at)}
                          {a.last_used_at && ` · used ${usedWhen(a.last_used_at, now)}`}
                        </span>
                      </span>
                      <Badge label={a.primary ? "Primary" : "Backup"} tone={a.primary ? "brand" : "neutral"} />
                      <Menu
                        label={`${a.name} actions`}
                        width={200}
                        compact
                        trigger={(p) => (
                          <button
                            type="button"
                            onClick={p.toggle}
                            aria-expanded={p["aria-expanded"]}
                            aria-haspopup={p["aria-haspopup"]}
                            aria-label={`${a.name} actions`}
                            className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken"
                          >
                            <Icon name="app/icon-more-20" size={16} />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <MenuItem
                              title="Rename"
                              onSelect={() => {
                                close();
                                setFailure(null);
                                setNewName(a.name);
                                setRenaming(a);
                              }}
                            />
                            {!a.primary && <MenuDivider />}
                            {!a.primary && (
                              <MenuItem
                                title="Remove"
                                tone="critical"
                                onSelect={() => {
                                  close();
                                  setFailure(null);
                                  setRemoving(a);
                                }}
                              />
                            )}
                          </>
                        )}
                      </Menu>
                    </li>
                  ))}
                  <li className="flex min-h-12 items-center gap-3 border-b border-border-default py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-label-s text-text-primary">Recovery codes</span>
                      <span className="text-caption text-text-secondary">
                        {data.recovery_codes.left} of {data.recovery_codes.total} left · generated {formatDate(data.recovery_codes.generated_at)}
                      </span>
                    </span>
                    <ButtonLink href="/sign-in/backup-codes" variant="secondary" size="sm">
                      View
                    </ButtonLink>
                  </li>
                </ul>
                <ButtonLink href="/sign-in/set-up-authenticator" variant="secondary" size="md" fullWidth>
                  Add an authenticator
                </ButtonLink>
              </>
            )}
          </Card>

          <Card
            title="Where you’re signed in"
            aside={
              others.length > 0 && (
                <button type="button" onClick={() => setConfirm(true)} className="flex h-8 items-center rounded text-label-s text-text-brand hover:underline">
                  Sign out all other sessions
                </button>
              )
            }
          >
            <div className="overflow-hidden rounded-lg border border-border-default">
              <table className="w-full table-fixed text-left">
                <thead className="border-b border-border-default bg-surface-raised">
                  <tr>
                    <th scope="col" className={th}>Device</th>
                    <th scope="col" className={`${th} w-[200px]`}>Location</th>
                    <th scope="col" className={`${th} w-[160px]`}>Last active</th>
                    <th scope="col" className={`${th} w-[110px]`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sessions.map((s) => (
                    <tr key={s.id} className="h-14 border-b border-border-default last:border-b-0">
                      <td className="truncate px-4 text-body-s text-text-primary">
                        {s.device}
                        {s.current ? " · this device" : ""}
                      </td>
                      <td className="truncate px-4 text-body-s text-text-primary">
                        {s.place} · {s.ip_masked}
                      </td>
                      <td className="px-4">
                        {s.current ? <Badge label="This session" tone="success" /> : <Badge label={activeWhen(s.last_active_at, now)} tone="neutral" />}
                      </td>
                      <td className="px-4 text-right">
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

        <Card title="Sign-in method" className="w-[360px] shrink-0">
          {!data ? <Skeleton className="h-32 w-full" /> : <SettingsList rows={signIn as Array<[string, string]>} />}
          <p className="-mt-2 text-caption text-text-secondary">Some settings are managed by your IT admin{data ? `, ${data.it_admin.name}` : ""}.</p>
        </Card>
      </div>

      {confirm && (
        /* I8 · Sign out other sessions — confirm */
        <Modal
          open
          onClose={() => setConfirm(false)}
          width={400}
          title={`Sign out ${others.length} other ${others.length === 1 ? "session" : "sessions"}?`}
          description={`${others.map((s) => `${s.device} (${s.place})`).join(" and ")} ${others.length === 1 ? "is" : "are"} signed out at once. You stay signed in here.`}
          actions={
            <>
              <Button variant="secondary" size="md" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button size="md" loading={busy} onClick={signOutOthers}>
                Sign out {others.length} {others.length === 1 ? "session" : "sessions"}
              </Button>
            </>
          }
        >
          <Banner tone="warning" title="Don’t recognise one of them?">
            Change your password too, and tell {data ? `${data.it_admin.name} (IT admin)` : "your IT admin"}. This is recorded in the audit log.
          </Banner>
          <CheckCard title="Change my password next" checked={changeNext} onChange={(e) => setChangeNext(e.target.checked)} />
        </Modal>
      )}

      {renaming && (
        <Modal
          open
          onClose={() => setRenaming(null)}
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
          <TextField size="md" label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <RequestError error={failure} />
        </Modal>
      )}

      {removing && (
        <Modal
          open
          onClose={() => setRemoving(null)}
          title={`Remove ${removing.name}?`}
          description={`You won’t be able to sign in with it any more. ${operator} requires two-step sign-in, so keep at least one.`}
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
