"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "./cn";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Kapat düğmesinin erişilebilir adı (çevrilmiş). */
  closeLabel: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
};

/**
 * Native `<dialog>` + `showModal()`: odak tuzağı, Esc, arka planın inert olması ve
 * kapanınca odağın tetikleyiciye dönmesi tarayıcıdan gelir. Arka plana tık → kapanır.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);
  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return { ref, onBackdrop };
}

function Header({ id, title, description, closeLabel, onClose }: { id: string; title: string; description?: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-(--space-4) border-b border-line px-(--space-6) py-(--space-4)">
      <div className="flex flex-col gap-(--space-1)">
        <h2 id={`${id}-title`} className="text-(length:--type-heading-md) font-semibold text-fg">
          {title}
        </h2>
        {description ? (
          <p id={`${id}-desc`} className="text-(length:--type-body-sm) text-fg-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-m-(--space-2) inline-flex size-(--touch-target-min) shrink-0 items-center justify-center rounded-control text-fg-secondary hover:bg-muted hover:text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)"
      >
        <X aria-hidden="true" className="size-(--icon-size-md)" />
      </button>
    </div>
  );
}

const dialogBase =
  "fixed m-0 max-h-none max-w-none bg-card p-0 text-fg backdrop:bg-(--color-overlay) open:flex open:flex-col";

/** Ortalanmış modal (mobilde alttan tam genişlik sayfa). */
export function Modal({ open, onClose, title, closeLabel, description, footer, children }: DialogProps) {
  const { ref, onBackdrop } = useDialog(open, onClose);
  const id = useId();
  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      className={cn(
        dialogBase,
        "inset-x-0 bottom-0 top-auto max-h-[90dvh] w-full rounded-t-overlay shadow-(--elevation-xl)",
        "sm:inset-0 sm:m-auto sm:h-fit sm:w-[min(var(--content-width-sm),calc(100vw-2*var(--gutter)))] sm:rounded-overlay",
      )}
    >
      <Header id={id} title={title} description={description} closeLabel={closeLabel} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-(--space-6) py-(--space-4)">{children}</div>
      {footer ? <div className="flex flex-wrap justify-end gap-(--space-3) border-t border-line px-(--space-6) py-(--space-4)">{footer}</div> : null}
    </dialog>
  );
}

/** Yan çekmece (mobil menü, panel sidebar'ı, filtreler). */
export function Drawer({ open, onClose, title, closeLabel, description, footer, children, side = "start" }: DialogProps & { side?: "start" | "end" }) {
  const { ref, onBackdrop } = useDialog(open, onClose);
  const id = useId();
  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      aria-labelledby={`${id}-title`}
      className={cn(
        dialogBase,
        "inset-y-0 h-dvh w-[min(var(--drawer-width),calc(100vw-var(--touch-target-min)))] shadow-(--elevation-xl)",
        side === "start" ? "left-0 right-auto" : "right-0 left-auto",
      )}
    >
      <Header id={id} title={title} description={description} closeLabel={closeLabel} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-(--space-4)">{children}</div>
      {footer ? <div className="border-t border-line p-(--space-4)">{footer}</div> : null}
    </dialog>
  );
}
