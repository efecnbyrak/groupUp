import type { ComponentProps } from "react";

import { cn } from "./cn";

type CardProps = ComponentProps<"div"> & { padding?: "none" | "sm" | "md" | "lg"; elevated?: boolean };

const paddings = { none: "", sm: "p-(--space-4)", md: "p-(--space-6)", lg: "p-(--space-6) sm:p-(--space-8)" };

/** Kart yüzeyi: kenarlık varsayılan; gölge yalnızca `elevated` (yüzen/öne çıkan) için. */
export function Card({ padding = "md", elevated = false, className, ...rest }: CardProps) {
  return <div className={cn("rounded-card border border-line bg-card", paddings[padding], elevated && "shadow-(--elevation-sm)", className)} {...rest} />;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-(--space-4)">
      <div className="flex flex-col gap-(--space-1)">
        <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{title}</h2>
        {description ? <p className="text-(length:--type-body-sm) text-fg-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
