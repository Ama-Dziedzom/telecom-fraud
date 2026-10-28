"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card } from "@/components/app/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/api/client";
import type { SearchResult } from "@/lib/api/fd";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * Number trace — start here from the sidebar: find the SIM by its number,
 * then the trace runs on the subscriber’s Calls tab (G35–G38). The design
 * has no frame for this step, so it reuses the lookup field.
 */
export default function NumberTracePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return setError("Enter a phone number to trace.");
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<SearchResult>("GET", `/search?q=${encodeURIComponent(q.trim())}&type=msisdn`);
      const hit = res.data.find((h) => h.kind === "subscriber" && h.subscriber);
      if (!hit?.subscriber) {
        setError(res.other_operator ? `That number is on ${res.other_operator.name}. You can only trace your own operator’s SIMs.` : "No subscriber with that number.");
        setBusy(false);
        return;
      }
      router.push(`/subscribers/${hit.subscriber.subscriber_id}?tab=calls`);
    } catch {
      setError("We couldn’t look that number up. Try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <AppHeader section="Investigate" title="Number trace" />
      <PageBody>
        <PageHead title="Number trace" subtitle="See where a SIM’s calls end up, from its call records. Every trace is logged." />
        <Card title="Trace a number" className="max-w-[720px]">
          <form onSubmit={submit} className="flex items-start gap-3">
            <TextField
              size="md"
              aria-label="Phone number"
              placeholder="e.g. 020 123 4471"
              inputMode="tel"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              error={error ?? undefined}
              iconLeft={<Icon name="app/icon-search" size={16} />}
              className="min-w-0 flex-1"
            />
            <Button type="submit" size="md" loading={busy}>
              Trace
            </Button>
          </form>
          <p className="text-caption text-text-secondary">The trace opens on the subscriber’s Calls tab and covers the last 24 hours.</p>
        </Card>
      </PageBody>
    </>
  );
}
