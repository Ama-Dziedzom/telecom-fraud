"use client";

import { cn } from "@/lib/cn";
import { Fragment, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  /** Bump to replay the error shake (e.g. after each failed attempt). */
  errorKey?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
};

/**
 * OTP digit set: 6 boxes, auto-advance, paste fills all, error shakes once.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error = false,
  errorKey,
  autoFocus,
  "aria-label": ariaLabel = "One-time code",
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const setDigit = (i: number, digit: string) => {
    const next = digits.slice();
    next[i] = digit;
    onChange(next.join("").slice(0, length));
  };

  const handleChange = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return;
    if (clean.length > 1) {
      // Some mobile keyboards deliver the full code into one box.
      onChange((value.slice(0, i) + clean).slice(0, length));
      focusAt(i + clean.length);
      return;
    }
    setDigit(i, clean);
    focusAt(i + 1);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        setDigit(i, "");
      } else if (i > 0) {
        setDigit(i - 1, "");
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      focusAt(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focusAt(pasted.length);
  };

  const half = Math.ceil(length / 2);

  return (
    <div
      key={errorKey}
      role="group"
      aria-label={ariaLabel}
      className={cn("flex items-center gap-2.5", error && "animate-shake")}
    >
      {digits.map((digit, i) => (
        <Fragment key={i}>
          {i === half && (
            <span aria-hidden className="h-0.5 w-2 rounded-[1px] bg-border-strong" />
          )}
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            maxLength={length}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={error || undefined}
            className={cn(
              "h-15 w-13 rounded-[10px] bg-surface-base text-center font-mono text-mono-code caret-brand-primary outline-none",
              error
                ? "border-[1.5px] border-critical-fg text-critical-fg"
                : cn(
                    "text-text-primary focus:border-[1.5px] focus:border-border-focus focus:shadow-focus",
                    digit ? "border-[1.5px] border-border-default" : "border border-border-default",
                  ),
            )}
          />
        </Fragment>
      ))}
    </div>
  );
}
