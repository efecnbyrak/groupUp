import { Download, Laptop, LogOut, Shield, Trash2, UserRound } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { displayUser, requirePageUser } from "@/app/_lib/page-user";
import { Avatar, Badge, Button, buttonClasses, ButtonLink, Card } from "@/components/ui";
import { getT } from "@/i18n/server";
import { logoutAction, logoutAllAction } from "@/modules/identity";

export const generateMetadata = titled("auth.account.title");


async function AccountContent() {
  const [t, user] = await Promise.all([getT(), requirePageUser("/hesap")]);
  const display = displayUser(user, t);
  return (
    <>
      <h1 className="font-display text-heading-xl font-semibold text-fg">{t("auth.account.title")}</h1>
      <Card padding="lg" className="flex flex-col gap-(--space-6)">
        <div className="flex items-center gap-(--space-4)">
          <Avatar name={display.name} src={display.avatarUrl} size="lg" />
          <div className="flex min-w-0 flex-col gap-(--space-1)">
            <p className="truncate text-(length:--type-heading-sm) font-semibold text-fg">{display.name}</p>
            <p className="text-fg-secondary">{t("auth.account.signedInAs", { email: user.email })}</p>
            <Badge tone="brand" className="self-start">
              {display.roleLabel}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-(--space-3) border-t border-line pt-(--space-6)">
          <ButtonLink href="/profil" variant="secondary" icon={<UserRound aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("profile.title")}
          </ButtonLink>
          <ButtonLink href="/hesap/guvenlik" variant="secondary" icon={<Shield aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("auth.account.security")}
          </ButtonLink>
          <ButtonLink href="/hesap/oturumlar" variant="secondary" icon={<Laptop aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("account.sessions.title")}
          </ButtonLink>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" icon={<LogOut aria-hidden="true" className="size-(--icon-size-sm)" />}>
              {t("auth.account.logout")}
            </Button>
          </form>
          <form action={logoutAllAction}>
            <Button type="submit" variant="ghost">
              {t("auth.account.logoutAll")}
            </Button>
          </form>
        </div>
      </Card>
      <Card padding="lg" className="flex flex-col gap-(--space-3)">
        <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("account.export.title")}</h2>
        <p className="text-(length:--type-body-sm) text-fg-secondary">{t("account.export.body")}</p>
        <a href="/api/v1/account/export" className={buttonClasses({ variant: "secondary", className: "self-start" })}>
          <Download aria-hidden="true" className="size-(--icon-size-sm)" />
          {t("account.export.download")}
        </a>
      </Card>
      <Card padding="lg" className="flex flex-col gap-(--space-3)">
        <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("account.delete.title")}</h2>
        <p className="text-(length:--type-body-sm) text-fg-secondary">{t("account.delete.teaser")}</p>
        <ButtonLink href="/hesap/sil" variant="ghost" className="self-start text-negative" icon={<Trash2 aria-hidden="true" className="size-(--icon-size-sm)" />}>
          {t("account.delete.title")}
        </ButtonLink>
      </Card>
    </>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountContent />
    </Suspense>
  );
}
