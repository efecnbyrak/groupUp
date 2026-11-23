"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Drawer, IconButton } from "@/components/ui";

/** Panel sidebar'ının mobil hali: çekmece. Sayfa değişince kapanır. */
export function PanelMobileNav({ labels, children }: { labels: { open: string; title: string; close: string }; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  return (
    <>
      <IconButton label={labels.open} icon={<Menu aria-hidden="true" className="size-(--icon-size-md)" />} onClick={() => setOpen(true)} className="lg:hidden" />
      <Drawer open={open} onClose={() => setOpen(false)} title={labels.title} closeLabel={labels.close}>
        {children}
      </Drawer>
    </>
  );
}
