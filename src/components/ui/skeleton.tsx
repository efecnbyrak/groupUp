import { cn } from "./cn";

/** Yükleme iskeleti: gerçek içeriğin boyutunu taklit eder (CLS yok). Hareket reduced-motion'da durur. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-muted motion-reduce:animate-none", className)} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-(--space-2)">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-(--space-4)", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}
