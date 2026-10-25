"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return { copied, copy };
}

/** Reference row — “Reference  SSO-403 · 7F3A-21C9  [copy]”. */
export function ReferenceRow({ value }: { value: string }) {
  const { copied, copy } = useCopy(value);
  return (
    <div className="flex w-full items-center gap-2 rounded-[10px] bg-surface-sunken px-3.5 py-2.5">
      <span className="text-caption text-text-secondary">Reference</span>
      <span className="font-mono text-mono-s text-text-primary">{value}</span>
      <span className="flex-1" />
      <span aria-live="polite" className="text-caption text-success-fg">
        {copied ? "Copied" : ""}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy reference"
        className="flex rounded"
      >
        <Icon name="icon-copy-secondary" size={16} />
      </button>
    </div>
  );
}

/** Inline brand link-button that copies text, e.g. “Copy key”. */
export function CopyLink({ value, children }: { value: string; children: ReactNode }) {
  const { copied, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 rounded text-label-s text-text-brand hover:underline"
    >
      <Icon name="icon-copy-brand-14" size={14} />
      {copied ? "Copied" : children}
    </button>
  );
}
