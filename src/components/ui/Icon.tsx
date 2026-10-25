import Image from "next/image";

/**
 * Renders an icon exported from Figma (public/figma/auth/<name>.svg).
 * Colours are baked into each SVG, so pick the variant that matches the design.
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
  return (
    <Image
      src={`/figma/auth/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={className ?? "shrink-0"}
    />
  );
}
