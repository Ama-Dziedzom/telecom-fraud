"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useEvidence, type Evidence, type EvidenceDownload, type EvidenceView } from "@/lib/api/cases";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/time";
import { useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { DetailRows, RowTile } from "./parts";

const MAX_BYTES = 50 * 1024 * 1024;
const KIND_BADGE: Record<string, string> = {
  transactions: "From transactions",
  call_log: "Call log",
  auto: "Auto-collected",
  file: "Uploaded",
  note: "Note",
};

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
/** “6.4 of 9.8 MB” — one unit, on the total. */
const progressOf = (done: number, total: number) =>
  total >= 1024 * 1024 ? `${(done / 1024 / 1024).toFixed(1)} of ${(total / 1024 / 1024).toFixed(1)} MB` : `${Math.round(done / 1024)} of ${size(total)}`;

type Upload = { key: number; file: File; progress: number; error?: string; xhr?: XMLHttpRequest; startedAt: number; secondsLeft?: number };

const ghost = "flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-sunken";
const row = "flex min-h-[60px] items-center gap-3 rounded-lg border bg-surface-base py-3 pr-2 pl-3";

/** C6 · Evidence — drag & drop uploads with progress, the size limit and chain of custody. */
export function EvidenceTab({ caseId }: { caseId: string }) {
  const { data } = useEvidence(caseId);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<Evidence | null>(null);
  const items = data?.data ?? [];

  const update = (key: number, patch: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const remove = (key: number) => setUploads((u) => u.filter((x) => x.key !== key));

  // A short-lived signed link to a watermarked copy; the download is logged.
  const download = async (ev: Evidence) => {
    // Open the tab now, while it still counts as the click, and point it at the link once it arrives.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const d = await apiFetch<EvidenceDownload>("GET", `/evidence/${ev.id}/download`);
      if (tab) tab.location.href = d.url;
      else window.location.assign(d.url);
    } catch {
      tab?.close();
      toast({ tone: "error", title: "Couldn’t download the file", body: "Try again." });
    }
  };

  const start = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const key = Date.now() + Math.random();
      if (file.size > MAX_BYTES) {
        setUploads((u) => [...u, { key, file, progress: 0, startedAt: Date.now(), error: `${size(file.size)} is over the 50 MB limit. Trim the clip or ask the branch for a link.` }]);
        continue;
      }
      // XHR, not fetch, for upload progress. Multipart, as in the collection.
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const startedAt = Date.now();
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const progress = e.loaded / e.total;
        const secondsLeft = progress > 0.05 ? Math.max(1, Math.round((((Date.now() - startedAt) / progress) * (1 - progress)) / 1000)) : undefined;
        update(key, { progress, secondsLeft });
      };
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          remove(key);
          await mutate(`/cases/${caseId}/evidence`);
        } else update(key, { error: "The upload didn’t go through. Try again." });
      };
      xhr.onerror = () => update(key, { error: "Connection lost while uploading. Try again." });
      xhr.open("POST", `/api/fd/cases/${caseId}/evidence`);
      xhr.send(form);
      setUploads((u) => [...u, { key, file, progress: 0, xhr, startedAt: Date.now() }]);
    }
  };

  return (
    <Card title="Evidence" aside={<CardMeta>Every file is fingerprinted and logged for chain of custody</CardMeta>}>
      <div className="flex flex-col gap-1.5">
        <p className="text-label-s text-text-primary">Add evidence</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            start(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6",
            dragging ? "border-brand-primary bg-brand-primary-subtle" : "border-border-strong bg-surface-raised",
          )}
        >
          <Icon name="app/icon-download-tertiary-20" size={20} className="shrink-0 rotate-180" />
          <p className="flex gap-1 text-body-s text-text-primary">
            Drop files here or
            <button type="button" onClick={() => input.current?.click()} className="rounded text-label-s text-text-brand underline">
              browse
            </button>
          </p>
          <p className="text-caption text-text-tertiary">PDF, images, audio, video, CSV · up to 50 MB each</p>
          <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && start(e.target.files)} />
        </div>
      </div>

      <ul className="flex flex-col gap-2 pt-2">
        {items.map((ev) => (
          <li key={ev.id} className={cn(row, "border-border-default")}>
            <RowTile icon="app/icon-file-secondary-16" size={16} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-label-s text-text-primary">{ev.title}</span>
              <span className="truncate text-caption text-text-secondary">
                {[ev.item_count ? `${ev.item_count} transactions` : size(ev.size_bytes), ev.attached_by?.name ? `${ev.kind === "transactions" ? "saved by " : ""}${ev.attached_by.name}` : "System", formatClock(ev.attached_at)].join(" · ")}
              </span>
            </span>
            <Badge label={KIND_BADGE[ev.kind] ?? ev.kind} tone="neutral" />
            <button type="button" aria-label={`View ${ev.title}`} onClick={() => setViewing(ev)} className={ghost}>
              <Icon name="app/icon-eye-primary-18" size={16} />
            </button>
            <button type="button" onClick={() => download(ev)} aria-label={`Download ${ev.title}`} className={ghost}>
              <Icon name="app/icon-download-18" size={16} />
            </button>
          </li>
        ))}
        {uploads.map((u) =>
          u.error ? (
            <li key={u.key} role="alert" className={cn(row, "border-critical-border")}>
              <RowTile icon="app/icon-alert-circle-critical-16" size={16} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-label-s text-text-primary">{u.file.name}</span>
                <span className="text-caption text-critical-fg">Couldn’t upload: {u.error}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  remove(u.key);
                  input.current?.click();
                }}
              >
                Choose another file
              </Button>
              <button type="button" aria-label={`Remove ${u.file.name}`} onClick={() => remove(u.key)} className={ghost}>
                <Icon name="app/icon-x-primary-16" size={16} />
              </button>
            </li>
          ) : (
            <li key={u.key} className={cn(row, "border-border-default")}>
              <RowTile icon="app/icon-file-secondary-16" size={16} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-label-s text-text-primary">{u.file.name}</span>
                <span
                  role="progressbar"
                  aria-label={`Uploading ${u.file.name}`}
                  aria-valuenow={Math.round(u.progress * 100)}
                  className="h-1 w-60 overflow-hidden rounded-full bg-border-default"
                >
                  <span className="block h-1 rounded-full bg-text-primary" style={{ width: `${u.progress * 100}%` }} />
                </span>
                <span className="text-caption text-text-secondary">
                  {progressOf(u.file.size * u.progress, u.file.size)}
                  {u.secondsLeft ? ` · about ${u.secondsLeft} s left` : ""}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  u.xhr?.abort();
                  remove(u.key);
                }}
              >
                Cancel
              </Button>
            </li>
          ),
        )}
      </ul>
      {viewing && <EvidenceViewer evidence={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}

/** GET /evidence/{id}/view — logged as an audit event; pages are watermarked images, never the raw file. */
function EvidenceViewer({ evidence, onClose }: { evidence: Evidence; onClose: () => void }) {
  const { data } = useApi<EvidenceView>(`/evidence/${evidence.id}/view`);
  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={evidence.title}
      description={data ? data.watermark.text : "Opening… this view is recorded in the audit log."}
      actions={
        <Button variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>
      }
    >
      {data && (
        <div className="flex flex-col gap-3">
          <div className="w-fit">
            <Badge
              label={data.integrity.unchanged_since_upload ? "Unchanged since upload" : "Fingerprint recorded"}
              tone={data.integrity.unchanged_since_upload ? "success" : "neutral"}
            />
          </div>
          <DetailRows
            rows={[
              ["SHA-256", <span key="h" className="font-mono text-mono-s break-all">{evidence.sha256}</span>],
              ["Pages", evidence.pages],
              ["Size", size(evidence.size_bytes)],
              ["Kept until", evidence.retention_until],
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
