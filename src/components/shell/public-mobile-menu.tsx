"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ButtonLink, Drawer, IconButton } from "@/components/ui";

type MenuLink = { href: string; label: string };

/** Giriş yapmamış header'ın mobil menüsü (<1024): çekmece + bağlantılar + giriş/kayıt. */
export function PublicMobileMenu({
  links,
  labels,
  extra,
}: {
  links: MenuLink[];
  labels: { open: string; title: string; close: string; login: string; register: string };
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={labels.open} icon={<Menu aria-hidden="true" className="size-(--icon-size-md)" />} onClick={() => setOpen(true)} className="lg:hidden" />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={labels.title}
        closeLabel={labels.close}
        side="end"
        footer={
          <div className="flex flex-col gap-(--space-2)">
            <ButtonLink href="/kayit" block onClick={() => setOpen(false)}>
              {labels.register}
            </ButtonLink>
            <ButtonLink href="/giris" variant="secondary" block onClick={() => setOpen(false)}>
              {labels.login}
            </ButtonLink>
          </div>
        }
      >
        <nav className="flex flex-col">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex min-h-(--touch-target-min) items-center rounded-control px-(--space-3) text-(length:--type-body) font-semibold text-fg hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {extra ? <div className="mt-(--space-6)">{extra}</div> : null}
      </Drawer>
    </>
  );
}
