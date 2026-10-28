import { cn } from "@/lib/cn";
import Image from "next/image";

/** Logo / FraudDetection — Theme (Light, Dark) */
export function Logo({
  theme = "light",
  className,
}: {
  theme?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-[10px] px-3 py-2", className)}>
      <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#3b82f6_0%,#1d4ed8_71.4%)]">
        <Image src="/figma/auth/icon-activity.svg" alt="" width={18} height={18} />
      </span>
      <span className="text-h3">
        <span className={theme === "dark" ? "text-text-inverse" : "text-text-primary"}>
          Fraud
        </span>
        <span className={theme === "dark" ? "text-logo-accent" : "text-text-brand"}>
          Detection
        </span>
      </span>
    </div>
  );
}

const OPERATOR_COLOURS: Record<string, string> = {
  "Kasa Mobile": "bg-[#0f8b7a]",
  "Volta Telecom": "bg-[#e0661c]",
};

/** Logo / Operator — operator co-brand (initial mark; unknown operators use brand). */
export function OperatorLogo({ operator, showName = true }: { operator: string; showName?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "flex size-[26px] items-center justify-center rounded-full text-label-m text-text-inverse",
          OPERATOR_COLOURS[operator] ?? "bg-brand-primary",
        )}
      >
        {operator.trim()[0]?.toUpperCase()}
      </span>
      {showName && <span className="text-label-m text-text-primary">{operator}</span>}
    </div>
  );
}
