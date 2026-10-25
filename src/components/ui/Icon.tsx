import Image from "next/image";

/**
 * Renders an icon exported from Figma: “icon-x” → /figma/auth/icon-x.svg,
 * “app/icon-x” → /figma/app/icon-x.svg. Colours are baked into each SVG, so
 * pick the variant that matches the design.
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
  return (
    <Image
      src={`/figma/${path}.svg`}
      alt=""
      width={size}
      height={size}
      className={className ?? "shrink-0"}
    />
  );
}
