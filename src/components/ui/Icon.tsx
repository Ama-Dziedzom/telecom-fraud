import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

/**
 * Renders an icon exported from Figma: “icon-x” → /figma/auth/icon-x.svg,
 * “app/icon-x” → /figma/app/icon-x.svg. Colours are baked into each SVG, so
 * pick the variant that matches the design; inside `.icon-tint` (disabled
 * buttons) the icon takes the text colour instead.
 */
export function Icon({
  name,
  size,
  className,
}: {
  name: string;
  size: number;
  className?: string;
}) {
  const path = name.includes("/") ? name : `auth/${name}`;
  const src = `url(/figma/${path}.svg)`;
  return (
    <span
      aria-hidden
      className={cn("icon inline-block", className ?? "shrink-0")}
      style={{ width: size, height: size, background: `${src} center / contain no-repeat`, "--icon": src } as CSSProperties}
    />
  );
}
