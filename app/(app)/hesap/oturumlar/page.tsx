import { ArrowLeft, Laptop } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { confirmLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { ActionForm, Badge, Card, ConfirmAction, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { listSessions, revokeOtherSessionsAction, revokeSessionAction } from "@/modules/identity";

export const generateMetadata = titled("account.sessions.title");

async function Content() {
  const [t, locale, user] = await Promise.all([getT(), getLocale(), requirePageUser("/hesap/oturumlar")]);
  await connection();
  const sessions = await listSessions(user.id, user.sessionId, new Date());
  const confirm = confirmLabels(t);
  const others = sessions.filter((s) => !s.current).length;
  return (
    <>
      <Link href="/hesap" className="inline-flex min-h-(--touch-target-min) items-center gap-(--space-1) self-start text-(length:--type-body-sm) font-semibold text-(--color-link) hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {t("auth.security.back")}
      </Link>
      <div className="flex flex-col gap-(--space-1)">
        <h1 className="font-display text-heading-xl font-semibold text-fg">{t("account.sessions.title")}</h1>
        <p className="text-fg-secondary">{t("account.sessions.body")}</p>
      </div>
      <Card padding="none">
        <ul className="flex flex-col divide-y divide-line">
          {sessions.map((s) => {
            const device = [s.device.browser, s.device.os].filter(Boolean).join(" · ") || t("account.sessions.unknownDevice");
            return (
              <li key={s.id} className="flex flex-col gap-(--space-3) p-(--space-4) sm:flex-row sm:items-center sm:justify-between sm:px-(--space-6)">
                <div className="flex items-start gap-(--space-3)">
                  <span className="mt-(--space-0-5) text-fg-secondary">
                    <Laptop aria-hidden="true" className="size-(--icon-size-md)" />
                  </span>
                  <div className="flex flex-col gap-(--space-0-5)">
                    <p className="flex flex-wrap items-center gap-(--space-2) font-semibold text-fg">
                      {device}
                      {s.current ? <Badge tone="success">{t("account.sessions.current")}</Badge> : null}
                    </p>
                    <p className="text-(length:--type-body-sm) text-fg-secondary">
                      {t("account.sessions.lastSeen", { date: formatDateTime(s.lastSeenAt, locale) })} · {t("account.sessions.started", { date: formatDateTime(s.createdAt, locale) })}
                    </p>
                  </div>
                </div>
                {s.current ? null : (
                  <div className="self-start pl-(--space-8) sm:self-auto sm:pl-0">
                  <ConfirmAction
                    action={revokeSessionAction}
                    values={{ id: s.id }}
                    triggerLabel={t("account.sessions.revoke")}
                    title={t("account.sessions.revokeTitle", { device })}
                    description={t("account.sessions.revokeBody")}
                    {...confirm}
                  />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {others > 0 ? (
        <div className="self-start">
          <ActionForm action={revokeOtherSessionsAction} fields={[]} submitLabel={t("account.sessions.revokeOthers")} submitVariant="secondary" loadingLabel={confirm.loadingLabel} />
        </div>
      ) : null}
    </>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
