import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { ActionResult } from "@/lib/errors";

import { cn } from "./cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-(--color-info-subtle) border-(--color-info)", icon: <Info aria-hidden="true" className="size-(--icon-size-md) shrink-0 text-(--color-info)" /> },
  success: { box: "bg-(--color-success-subtle) border-positive", icon: <CircleCheck aria-hidden="true" className="size-(--icon-size-md) shrink-0 text-positive" /> },
  warning: { box: "bg-(--color-warning-subtle) border-caution", icon: <TriangleAlert aria-hidden="true" className="size-(--icon-size-md) shrink-0 text-caution" /> },
  danger: { box: "bg-(--color-danger-subtle) border-negative", icon: <CircleAlert aria-hidden="true" className="size-(--icon-size-md) shrink-0 text-negative" /> },
};

/** Satır içi uyarı. danger → role="alert" (hemen okunur), diğerleri role="status". */
export function Alert({ tone = "info", title, children, className }: { tone?: AlertTone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-(--space-3) rounded-control border-l-(length:--border-width-strong) p-(--space-3) text-(length:--type-body-sm) text-fg", tones[tone].box, className)}
    >
      {tones[tone].icon}
      <div className="flex flex-col gap-(--space-0-5)">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

/** Server action sonucunu gösterir: hata → danger, başarı mesajı → success. */
export function FormMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (state.ok) return state.message ? <Alert tone="success">{state.message}</Alert> : null;
  return <Alert tone="danger">{state.error}</Alert>;
}
