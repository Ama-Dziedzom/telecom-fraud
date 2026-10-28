import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type TooltipPlacement = "top" | "bottom" | "top-end";

const ARROW = {
  top: { src: "/figma/app/tooltip-arrow-down.svg", width: 10 },
  "top-end": { src: "/figma/app/tooltip-arrow-down-end.svg", width: 22 },
  bottom: { src: "/figma/app/tooltip-arrow-up.svg", width: 10 },
} as const;

/**
 * Tooltip bubble — text/primary fill, radius 6, Caption Medium title and an
 * optional Caption body at 80%, with a 10 × 5 arrow pointing at the target.
 * Placement Top (centred above), Bottom (centred below) or Top end (above,
 * right-aligned, for points near the right edge). Positioning is the
 * caller's: this renders the bubble and arrow only.
 */
export function TooltipBubble({
  title,
  body,
  placement = "top",
  className,
  style,
}: {
  title: ReactNode;
  body?: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
  style?: React.CSSProperties;
}) {
  const arrow = ARROW[placement];
  const arrowEl = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={arrow.src} alt="" width={arrow.width} height={5} className="block shrink-0" />
  );
  return (
    <span
      role="tooltip"
      className={cn("pointer-events-none flex flex-col", placement === "top-end" ? "items-end" : "items-center", className)}
      style={style}
    >
      {placement === "bottom" && arrowEl}
      <span className="flex flex-col gap-0.5 rounded-md bg-text-primary px-2 py-1.5 text-caption whitespace-nowrap text-text-inverse shadow-[0_4px_12px_-2px_rgb(15_23_42/0.16)]">
        <span className="font-medium">{title}</span>
        {body && <span className="opacity-80">{body}</span>}
      </span>
      {placement !== "bottom" && arrowEl}
    </span>
  );
}

const POSITION: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 mb-1 -translate-x-1/2",
  "top-end": "right-1/2 bottom-full mb-1 -mr-[17px]",
  bottom: "top-full left-1/2 mt-1 -translate-x-1/2",
};

/**
 * Classes for a TooltipBubble that appears on hover or keyboard focus of the
 * nearest `group/tip` ancestor — for targets that are already positioned
 * (map pins, chart dots) and can host the bubble themselves.
 */
export const tooltipOnHover = (placement: TooltipPlacement = "top") =>
  cn(
    "invisible absolute z-50 opacity-0 transition-opacity delay-0 duration-100",
    "group-hover/tip:visible group-hover/tip:opacity-100 group-hover/tip:delay-150",
    "group-has-[:focus-visible]/tip:visible group-has-[:focus-visible]/tip:opacity-100",
    POSITION[placement],
  );

/**
 * Tooltip — dark bubble on hover or keyboard focus of `children`. For
 * icon-only buttons, truncated text and chart data points; never for actions
 * or required information (keep the accessible name on the trigger itself).
 */
export function Tooltip({
  title,
  body,
  placement = "top",
  className,
  children,
}: {
  title: ReactNode;
  body?: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <TooltipBubble
        title={title}
        body={body}
        placement={placement}
        className={tooltipOnHover(placement)}
      />
    </span>
  );
}
