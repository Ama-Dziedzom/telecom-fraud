import { cn } from "@/lib/cn";
import type { PasswordRule, Strength } from "@/lib/password";
import { Icon } from "./Icon";

export function PasswordRules({ rules }: { rules: PasswordRule[] }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Password requirements">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={cn(
            "flex items-center gap-2 text-body-s",
            rule.state === "met" && "text-success-fg",
            rule.state === "failed" && "text-critical-fg",
            rule.state === "pending" && "text-text-secondary",
          )}
        >
          {rule.state === "pending" ? (
            <span className="flex size-4 shrink-0 items-center justify-center">
              <span className="size-1.5 rounded-full bg-border-strong" />
            </span>
          ) : (
            <Icon
              name={rule.state === "met" ? "icon-check-circle-success-16" : "icon-alert-circle-critical"}
              size={16}
            />
          )}
          <span>
            {rule.label}
            <span className="sr-only">
              {rule.state === "met" ? " (done)" : rule.state === "failed" ? " (not met)" : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StrengthMeter({ strength, empty = false }: { strength: Strength; empty?: boolean }) {
  const fill = strength.tone === "critical" ? "bg-critical-fg" : "bg-success-fg";
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 items-center gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-[2px]",
              !empty && i <= strength.score ? fill : "bg-border-default",
            )}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className={cn(
          "text-caption font-medium",
          strength.tone === "critical" ? "text-critical-fg" : "text-success-fg",
        )}
      >
        {!empty && (
          <>
            <span className="sr-only">Password strength: </span>
            {strength.label}
          </>
        )}
      </p>
    </div>
  );
}
