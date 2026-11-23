import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { displayUser, requirePageUser } from "@/app/_lib/page-user";
import { ActionForm, ButtonLink, Card, CardHeader, Skeleton, type FormField } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { GENDERS } from "@/lib/person-fields";
import { AvatarForm, getOwnProfile, updateProfileAction } from "@/modules/profile";
import { listFacultiesWithDepartments } from "@/modules/university";

export const generateMetadata = titled("profile.edit");

const CLASS_YEARS = [0, 1, 2, 3, 4, 5, 6] as const;

async function Content() {
  const [t, locale, user] = await Promise.all([getT(), getLocale(), requirePageUser("/profil/duzenle")]);
  const [data, faculties] = await Promise.all([getOwnProfile(user.id), user.universityId ? listFacultiesWithDepartments(user.universityId) : Promise.resolve([])]);
  const p = data?.profile;
  const name = (v: { nameTr: string; nameEn: string | null }) => (locale === "en" && v.nameEn) || v.nameTr;
  const isAlumni = data?.type === "ALUMNI";

  const fields: FormField[] = [
    { type: "text", name: "firstName", label: t("auth.fields.firstName"), required: true, maxLength: 60, autoComplete: "given-name", defaultValue: p?.firstName },
    { type: "text", name: "lastName", label: t("auth.fields.lastName"), required: true, maxLength: 60, autoComplete: "family-name", defaultValue: p?.lastName },
    { type: "text", name: "studentNo", label: t("auth.fields.studentNo"), required: true, maxLength: 20, defaultValue: p?.studentNo ?? undefined },
    {
      type: "select",
      name: "departmentId",
      label: t("profile.facultyDepartment"),
      required: true,
      placeholder: t("common.select"),
      defaultValue: p?.departmentId ?? "",
      options: faculties.flatMap((f) => f.departments.map((d) => ({ value: d.id, label: name(d), group: name(f) }))),
    },
    isAlumni
      ? { type: "number", name: "graduationYear", label: t("auth.fields.graduationYear"), required: true, min: 1950, max: 2100, defaultValue: p?.graduationYear?.toString() }
      : {
          type: "select",
          name: "classYear",
          label: t("auth.fields.classYear"),
          required: true,
          placeholder: t("common.select"),
          defaultValue: p?.classYear?.toString() ?? "",
          options: CLASS_YEARS.map((y) => ({ value: String(y), label: t(`auth.classYears.${y}`) })),
        },
    { type: "tel", name: "phone", label: t("auth.fields.phone"), required: true, autoComplete: "tel", defaultValue: p?.phone ?? undefined },
    { type: "select", name: "gender", label: t("auth.fields.gender"), required: true, defaultValue: p?.gender ?? "", placeholder: t("common.select"), options: GENDERS.map((g) => ({ value: g, label: t(`auth.genders.${g}`) })) },
    { type: "date", name: "birthDate", label: t("auth.fields.birthDate"), required: true, defaultValue: p?.birthDate?.toISOString().slice(0, 10) },
    { type: "textarea", name: "bio", label: t("profile.bio"), hint: t("profile.bioHint"), maxLength: 300, rows: 3, defaultValue: p?.bio ?? undefined },
  ];

  const display = displayUser(user, t);
  return (
    <>
      <div className="flex flex-col gap-(--space-2)">
        <ButtonLink href="/profil" variant="ghost" size="sm" className="self-start" icon={<ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />}>
          {t("profile.title")}
        </ButtonLink>
        <h1 className="font-display text-heading-xl font-semibold text-fg">{t("profile.edit")}</h1>
      </div>
      <Card padding="lg" className="flex flex-col gap-(--space-4)">
        <CardHeader title={t("profile.avatar.title")} />
        <AvatarForm
          name={display.name}
          currentUrl={display.avatarUrl}
          labels={{ choose: t("profile.avatar.choose"), upload: t("profile.avatar.upload"), remove: t("profile.avatar.remove"), hint: t("profile.avatar.hint"), loading: t("common.loading") }}
        />
      </Card>
      <Card padding="lg" className="flex flex-col gap-(--space-4)">
        <CardHeader title={t("profile.details")} description={t("profile.detailsBody")} />
        <div className="max-w-(--content-width-sm)">
          <ActionForm action={updateProfileAction} fields={fields} submitLabel={t("common.save")} loadingLabel={t("common.loading")} />
        </div>
      </Card>
    </>
  );
}

export default function EditProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
