import { LogOut, Shield } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { displayUser, requirePageUser } from "@/app/_lib/page-user";
import { Avatar, Badge, Button, ButtonLink, Card } from "@/components/ui";
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
          <Avatar name={display.name} size="lg" />
          <div className="flex min-w-0 flex-col gap-(--space-1)">
            <p className="truncate text-(length:--type-heading-sm) font-semibold text-fg">{display.name}</p>
            <p className="text-fg-secondary">{t("auth.account.signedInAs", { email: user.email })}</p>
            <Badge tone="brand" className="self-start">
              {display.roleLabel}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-(--space-3) border-t border-line pt-(--space-6)">
          <ButtonLink href="/hesap/guvenlik" variant="secondary" icon={<Shield aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("auth.account.security")}
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
