import { cn } from "./cn";

const sizes = { sm: "size-(--control-height-sm) text-(length:--type-caption)", md: "size-(--control-height-md) text-(length:--type-body-sm)", lg: "size-(--space-16) text-(length:--type-heading-md)" };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("tr");
}

/** Profil görseli; yoksa baş harfler. Görsel her zaman sabit boyutlu (CLS yok). */
/** `shape="square"`: kulüp logosu (köşeli). */
export function Avatar({ name, src, size = "md", shape = "circle", className }: { name: string; src?: string | null; size?: keyof typeof sizes; shape?: "circle" | "square"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden bg-brand-subtle font-semibold text-brand-active",
        sizes[size],
        shape === "circle" ? "rounded-full" : "rounded-control",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- kullanıcı görselleri F4'te sharp ile hazırlanır
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
