"use client";

import { Card } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useEvidence, type Evidence, type EvidenceDownload, type EvidenceView } from "@/lib/api/cases";
import { useApi } from "@/lib/api/fd";
import { formatClock } from "@/lib/time";
import { useRef, useState } from "react";
import { useSWRConfig } from "swr";

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

type Upload = { key: number; file: File; progress: number; error?: string; xhr?: XMLHttpRequest; startedAt: number; secondsLeft?: number };

/** C6 · Evidence — drag & drop uploads with progress, size limit and chain of custody. */
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
      toast({ title: "Couldn’t download the file", body: "Try again." });
    }
  };

  const start = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const key = Date.now() + Math.random();
      if (file.size > MAX_BYTES) {
        setUploads((u) => [...u, { key, file, progress: 0, startedAt: Date.now(), error: `${size(file.size)} is over the 50 MB limit. Trim the clip, or ask the branch to share a link.` }]);
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
    <Card
      title={
        <span className="flex items-center gap-2">
          Evidence <Badge label={String(items.length)} tone="neutral" />
        </span>
      }
      aside={
        <span className="flex items-center gap-1.5 text-caption text-text-tertiary">
          <Icon name="app/icon-shield-tertiary-16" size={16} />
          Every file is fingerprinted and logged for chain of custody
        </span>
      }
    >
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
        className={`flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed px-6 py-7 text-center ${dragging ? "border-brand-primary bg-brand-primary-subtle" : "border-brand-highlight"}`}
      >
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-brand-primary-subtle">
          <Icon name="app/icon-download-brand-22" size={22} />
        </span>
        <p className="text-body-m text-text-primary">
          Drag files here or{" "}
          <button type="button" onClick={() => input.current?.click()} className="text-text-brand hover:underline">
            browse
          </button>
        </p>
        <p className="text-caption text-text-tertiary">PDF, images, audio, video, CSV · up to 50 MB each</p>
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && start(e.target.files)} />
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((ev) => (
          <li key={ev.id} className="flex items-center gap-3 rounded-xl border border-border-subtle px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-primary-subtle">
              <Icon name="app/icon-file-brand-20" size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-label-m text-text-primary">{ev.title}</span>
              <span className="text-caption text-text-secondary">
                {[ev.item_count ? `${ev.item_count} transactions` : size(ev.size_bytes), ev.attached_by?.name ?? "System", formatClock(ev.attached_at)].join(" · ")}
              </span>
            </span>
            <Badge label={KIND_BADGE[ev.kind] ?? ev.kind} tone="neutral" />
            <button
              type="button"
              aria-label={`View ${ev.title}`}
              onClick={() => setViewing(ev)}
              className="flex size-8 items-center justify-center rounded-lg border border-border-default hover:bg-surface-raised"
            >
              <Icon name="app/icon-eye-primary-20" size={20} />
            </button>
            <button
              type="button"
              onClick={() => download(ev)}
              aria-label={`Download ${ev.title}`}
              className="flex size-8 items-center justify-center rounded-lg border border-border-default hover:bg-surface-raised"
            >
              <Icon name="app/icon-download-primary-20" size={20} />
            </button>
          </li>
        ))}
        {uploads.map((u) =>
          u.error ? (
            <li key={u.key} role="alert" className="flex items-center gap-3 rounded-xl border border-critical-border bg-critical-bg px-4 py-3">
              <Icon name="icon-alert-circle-critical-20" size={20} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-label-m text-text-primary">{u.file.name}</span>
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
              <button type="button" aria-label="Dismiss" onClick={() => remove(u.key)} className="flex size-8 items-center justify-center rounded-lg border border-border-default bg-surface-base">
                <Icon name="app/icon-x-primary-18" size={18} />
              </button>
            </li>
          ) : (
            <li key={u.key} className="flex items-center gap-3 rounded-xl border border-border-subtle px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-primary-subtle">
                <Icon name="app/icon-file-brand-20" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-label-m text-text-primary">{u.file.name}</span>
                <span className="text-caption text-text-secondary">
                  Uploading · {size(u.file.size * u.progress)} of {size(u.file.size)}
                  {u.secondsLeft ? ` · about ${u.secondsLeft} s left` : ""}
                </span>
                <span className="h-1 w-[250px] rounded-full bg-surface-sunken" aria-hidden>
                  <span className="block h-1 rounded-full bg-brand-primary" style={{ width: `${u.progress * 100}%` }} />
                </span>
              </span>
              <span className="text-label-s text-text-brand">{Math.round(u.progress * 100)}%</span>
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
      width={640}
      title={evidence.title}
      description={data ? data.watermark.text : "Opening… this view is recorded in the audit log."}
      actions={
        <Button variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>
      }
    >
      {data && (
        <div className="flex flex-col gap-2 text-body-s">
          <Badge
            label={data.integrity.unchanged_since_upload ? "Unchanged since upload" : "Fingerprint recorded"}
            tone={data.integrity.unchanged_since_upload ? "success" : "neutral"}
          />
          <p className="font-mono text-mono-s text-text-tertiary">SHA-256 {evidence.sha256}</p>
          <p className="text-text-secondary">
            {evidence.pages} {evidence.pages === 1 ? "page" : "pages"} · {size(evidence.size_bytes)} · kept until {evidence.retention_until}
          </p>
        </div>
      )}
    </Modal>
  );
}
