import { Pencil } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { displayUser, requirePageUser } from "@/app/_lib/page-user";
import { Avatar, Badge, ButtonLink, Card, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { getOwnProfile } from "@/modules/profile";

export const generateMetadata = titled("profile.title");

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-(--space-0-5) sm:flex-row sm:gap-(--space-4)">
      <dt className="text-(length:--type-body-sm) text-fg-secondary sm:w-(--space-32) sm:shrink-0">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}

async function Content() {
  const [t, locale, user] = await Promise.all([getT(), getLocale(), requirePageUser("/profil")]);
  const data = await getOwnProfile(user.id);
  const p = data?.profile;
  const display = displayUser(user, t);
  const localized = (v?: { nameTr: string; nameEn: string | null } | null) => (v ? (locale === "en" && v.nameEn) || v.nameTr : "—");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-(--space-4)">
        <h1 className="font-display text-heading-xl font-semibold text-fg">{t("profile.title")}</h1>
        <ButtonLink href="/profil/duzenle" variant="secondary" icon={<Pencil aria-hidden="true" className="size-(--icon-size-sm)" />}>
          {t("profile.edit")}
        </ButtonLink>
      </div>
      <Card padding="lg" className="flex flex-col gap-(--space-6)">
        <div className="flex items-center gap-(--space-4)">
          <Avatar name={display.name} src={display.avatarUrl} size="lg" />
          <div className="flex min-w-0 flex-col gap-(--space-1)">
            <p className="truncate text-(length:--type-heading-sm) font-semibold text-fg">{display.name}</p>
            <p className="truncate text-fg-secondary">{user.email}</p>
            <Badge tone="brand" className="self-start">
              {display.roleLabel}
            </Badge>
          </div>
        </div>
        {p?.bio ? <p className="max-w-(--content-width-prose) text-fg">{p.bio}</p> : null}
        <dl className="flex flex-col gap-(--space-3) border-t border-line pt-(--space-6)">
          <Row label={t("profile.university")} value={data?.university?.name ?? "—"} />
          <Row label={t("auth.fields.faculty")} value={localized(p?.faculty)} />
          <Row label={t("auth.fields.department")} value={localized(p?.department)} />
          {data?.type === "ALUMNI" ? (
            <Row label={t("auth.fields.graduationYear")} value={p?.graduationYear ?? "—"} />
          ) : (
            <Row label={t("auth.fields.classYear")} value={p?.classYear !== null && p?.classYear !== undefined ? t(`auth.classYears.${p.classYear as 0 | 1 | 2 | 3 | 4 | 5 | 6}`) : "—"} />
          )}
          <Row label={t("auth.fields.studentNo")} value={p?.studentNo ?? "—"} />
          <Row label={t("auth.fields.phone")} value={p?.phone ?? "—"} />
          <Row label={t("auth.fields.birthDate")} value={p?.birthDate ? formatDate(p.birthDate, locale) : "—"} />
        </dl>
        <p className="text-(length:--type-caption) text-fg-secondary">{t("profile.privacyNote")}</p>
      </Card>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
