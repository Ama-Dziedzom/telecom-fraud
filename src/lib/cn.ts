export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** `w-full` unless the caller already sized the element (there’s no class merging here). */
export function fullWidthUnless(className?: string) {
  return /(^|\s)(w-|flex-1|min-w-0 flex-1)/.test(className ?? "") ? undefined : "w-full";
}
