"use client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/time";
import { useState } from "react";

type Format = "pdf" | "images" | "link";

const FORMATS: Array<{ id: Format; icon: string; title: string; detail: string; button: string }> = [
  { id: "pdf", icon: "app/icon-file-primary-18", title: "PDF · 6 pages", detail: "For email, print or the case file", button: "Export PDF" },
  { id: "images", icon: "app/icon-chart-secondary-18", title: "Images · one per chapter", detail: "PNG, ready to drop into slides", button: "Export images" },
  { id: "link", icon: "app/icon-external-18", title: "View-only link", detail: "Expires in 7 days · sign-in required", button: "Create link" },
];

function Switch({ checked, locked, onChange, label }: { checked: boolean; locked?: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={locked}
      onClick={() => onChange?.(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-brand-primary" : "bg-border-strong", locked && "cursor-not-allowed")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-surface-base transition-transform", checked && "translate-x-4")} />
    </button>
  );
}

/** E19/E20/E23 · Export this story — masked and watermarked, logged to the audit trail. */
export function StoryExport({
  caseId,
  msisdn,
  author,
  now,
  initialFormat = "pdf",
  onClose,
}: {
  caseId: string;
  msisdn: string;
  author: string;
  now: number;
  initialFormat?: Format;
  onClose: () => void;
}) {
  const toast = useToast();
  const [format, setFormat] = useState<Format>(initialFormat);
  const [thumbs, setThumbs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const spec = FORMATS.find((f) => f.id === format)!;

  const go = async () => {
    setBusy(true);
    setFailure(null);
    try {
      // TODO(api): proposed POST /cases/{id}/brief/export; GET …/brief?format=pdf exists but has no options.
      const res = await apiFetch<{ file_name: string | null; url: string; pages: number; size_bytes: number }>("POST", `/cases/${caseId}/brief/export`, {
        format,
        include_thumbnails: thumbs,
        mask_numbers: true,
        watermark: true,
      });
      if (format === "link") {
        await navigator.clipboard?.writeText(res.url).catch(() => undefined);
        toast({ tone: "success", title: "View-only link copied", body: "Expires in 7 days · sign-in required · logged to the audit trail" });
      } else {
        toast({
          tone: "success",
          title: "Story exported",
          body: `${res.file_name} · ${res.pages} ${format === "images" ? "images" : "pages"} · ${(res.size_bytes / 1_000_000).toFixed(1)} MB · logged to the audit trail`,
          action: { label: "Open file", onClick: () => window.open(res.url, "_blank", "noopener") },
        });
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={600}
      title={
        <span className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary-subtle">
            <Icon name="app/icon-download-brand-22" size={22} />
          </span>
          <span className="flex flex-col gap-1">
            Export this story
            <span className="text-body-m font-normal text-text-secondary">Anyone you send it to will see exactly these six chapters. Nothing else from the case.</span>
          </span>
        </span>
      }
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={go} loading={busy} iconLeft={<Icon name="app/icon-download-white-18" size={18} />}>
            {failure ? "Try again" : spec.button}
          </Button>
        </>
      }
    >
      {failure && (
        <Banner tone="error" title={failure.problem.title ?? "Export failed"}>
          {failure.problem.detail}
        </Banner>
      )}
      <div role="radiogroup" className="flex flex-col gap-2">
        {FORMATS.map((f) => (
          <label
            key={f.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5",
              format === f.id ? "border-[1.5px] border-brand-primary bg-brand-primary-subtle" : "border-border-default",
            )}
          >
            <Icon name={f.icon} size={18} />
            <span className="flex flex-1 flex-col">
              <span className="text-body-m text-text-primary">{f.title}</span>
              <span className="text-caption text-text-secondary">{f.detail}</span>
            </span>
            <input
              type="radio"
              name="format"
              checked={format === f.id}
              onChange={() => setFormat(f.id)}
              className="size-[18px] cursor-pointer appearance-none rounded-full border-[1.25px] border-border-strong checked:border-[5px] checked:border-brand-primary"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-overline text-text-tertiary uppercase">Include</p>
        {[
          ["Mask phone numbers", `Always on outside the case: ${msisdn.replace("+", "")}`, true, true] as const,
          ["Evidence thumbnails", thumbs ? "Adds 14 images, about 31 MB" : "Adds 3 images, about 4 MB", thumbs, false] as const,
          ["Watermark", `“Confidential · Kasa Mobile · ${author} · ${formatDay(now).replace(/^\w+ /, "")} ${new Date(now).getFullYear()}”`, true, true] as const,
        ].map(([title, sub, on, locked]) => (
          <div key={title} className="flex items-center gap-3">
            <span className="flex flex-1 flex-col">
              <span className="flex items-center gap-1.5 text-body-m text-text-primary">
                {title}
                {locked && <Icon name="icon-lock-secondary-16" size={14} />}
              </span>
              <span className="text-caption text-text-secondary">{sub}</span>
            </span>
            <Switch label={title} checked={on} locked={locked} onChange={title === "Evidence thumbnails" ? setThumbs : undefined} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
