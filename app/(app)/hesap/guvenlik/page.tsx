import Link from "next/link";
import { Suspense } from "react";

import { getT } from "@/i18n/server";
import { ChangeEmailForm, ChangePasswordForm, labelsFor, SECURITY_KEYS } from "@/modules/identity";

import { requirePageUser } from "../current-user";

export const metadata = { title: "Güvenlik — groupUp" };

const sectionClass = "flex flex-col gap-(--space-4) rounded-card border border-line bg-card p-(--space-6)";

async function SecurityContent() {
  const [t] = await Promise.all([getT(), requirePageUser("/hesap/guvenlik")]);
  const labels = labelsFor(t, SECURITY_KEYS);
  return (
    <>
      <Link href="/hesap" className="text-(--color-link) underline">
        {t("auth.security.back")}
      </Link>
      <h1 className="font-display text-heading-xl font-semibold text-fg">{t("auth.security.title")}</h1>
      <section className={sectionClass} aria-labelledby="change-password">
        <h2 id="change-password" className="text-heading-lg font-semibold text-fg">
          {t("auth.security.changePassword")}
        </h2>
        <ChangePasswordForm labels={labels} />
      </section>
      <section className={sectionClass} aria-labelledby="change-email">
        <h2 id="change-email" className="text-heading-lg font-semibold text-fg">
          {t("auth.security.changeEmail")}
        </h2>
        <ChangeEmailForm labels={labels} />
      </section>
    </>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={null}>
      <SecurityContent />
    </Suspense>
  );
}
