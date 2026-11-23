import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { personName } from "@/app/_components/requests";
import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Avatar, Badge, ButtonLink, Card, CardHeader, ConfirmAction, EmptyState, Skeleton, Table } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { ATTACHMENT_ACCEPT } from "@/lib/attachments";
import { formatDate } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import {
  adminRemoveMemberAction,
  adminRemoveStaffAction,
  assignPresidentAction,
  docToText,
  getClubForAdmin,
  listMembers,
  listStaff,
  updateClubDirectAction,
} from "@/modules/club";

import { requireAdminPage } from "../../admin-context";

export const generateMetadata = titled("admin.nav.clubs");
const IMAGE_ACCEPT = ATTACHMENT_ACCEPT.replace("application/pdf,", "");

async function Content({ params }: PageProps<"/panel/admin/kulupler/[id]">) {
  const [t, locale, { id }, { university }] = await Promise.all([getT(), getLocale(), params, requireAdminPage()]);
  const club = await getClubForAdmin(university.id, id);
  if (!club) notFound();
  const [members, staff] = await Promise.all([listMembers(club.id), listStaff(club.id)]);
  const labels = formLabels(t);
  const confirm = confirmLabels(t);
  const hidden = (name: string, value: string) => ({ type: "hidden" as const, name, value });

  return (
    <>
      <Link href="/panel/admin/kulupler" className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {t("admin.nav.clubs")}
      </Link>
      <PageHeader
        title={club.name}
        description={`${locale === "en" ? club.category.nameEn : club.category.nameTr} · ${t("club.memberCount", { count: club._count.memberships })}`}
        action={
          <ButtonLink href={`/kulupler/${club.slug}`} variant="secondary" icon={<ExternalLink aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("club.admin.viewPage")}
          </ButtonLink>
        }
      />

      <div className="grid gap-(--space-6) lg:grid-cols-2">
        <Card className="flex flex-col gap-(--space-4)">
          <CardHeader
            title={t("club.fields.president")}
            action={
              <ActionDialog
                triggerLabel={t("club.admin.changePresident")}
                title={t("club.admin.changePresident")}
                description={t("club.admin.changePresidentBody")}
                action={assignPresidentAction}
                fields={[hidden("universityId", university.id), hidden("clubId", club.id), { type: "email", name: "email", label: t("club.fields.presidentEmail"), required: true, autoComplete: "off" }]}
                submitLabel={t("common.save")}
                {...labels}
              />
            }
          />
          {club.president ? (
            <div className="flex items-center gap-(--space-3)">
              <Avatar name={personName(club.president)} src={publicFileUrl(club.president.profile?.avatarKey)} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-fg">{personName(club.president)}</span>
                <span className="truncate text-(length:--type-caption) text-fg-secondary">{club.president.email}</span>
              </span>
            </div>
          ) : (
            <p className="text-fg-secondary">{t("club.noPresident")}</p>
          )}
        </Card>

        <Card className="flex flex-col gap-(--space-4)">
          <CardHeader
            title={t("club.info.title")}
            description={t("club.admin.directEditBody")}
            action={
              <ActionDialog
                triggerLabel={t("common.edit")}
                title={t("club.info.title")}
                action={updateClubDirectAction}
                fields={[
                  hidden("universityId", university.id),
                  hidden("clubId", club.id),
                  { type: "textarea", name: "shortDescTr", label: t("club.fields.shortDesc"), required: true, maxLength: 200, rows: 3, defaultValue: club.shortDescTr },
                  { type: "textarea", name: "description", label: t("club.fields.description"), hint: t("club.fields.descriptionHint"), maxLength: 2000, rows: 6, defaultValue: docToText(club.descriptionTr) },
                  { type: "email", name: "contactEmail", label: t("club.fields.contactEmail"), defaultValue: club.contactEmail ?? undefined },
                  { type: "text", name: "instagram", label: t("club.fields.instagram"), placeholder: "@kulup", maxLength: 31, defaultValue: club.instagram ?? undefined },
                  { type: "file", name: "logo", label: t("club.fields.logo"), hint: t("club.fields.imageHint"), accept: IMAGE_ACCEPT },
                  { type: "file", name: "cover", label: t("club.fields.cover"), hint: t("club.fields.imageHint"), accept: IMAGE_ACCEPT },
                ]}
                submitLabel={t("common.save")}
                {...labels}
              />
            }
          />
          <dl className="grid gap-(--space-2) text-(length:--type-body-sm)">
            <div>
              <dt className="font-semibold text-fg">{t("club.fields.shortDesc")}</dt>
              <dd className="text-fg-secondary">{club.shortDescTr}</dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">{t("club.fields.contactEmail")}</dt>
              <dd className="text-fg-secondary">{club.contactEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">{t("club.fields.instagram")}</dt>
              <dd className="text-fg-secondary">{club.instagram ? `@${club.instagram}` : "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <section className="flex flex-col gap-(--space-3)">
        <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("club.staff.title")}</h2>
        <Table
          caption={t("club.staff.title")}
          columns={[
            { key: "name", header: t("admin.users.person") },
            { key: "title", header: t("club.staff.titleField") },
            { key: "actions", header: t("common.actions"), align: "end" },
          ]}
          rows={staff.map((s) => ({
            id: s.id,
            cells: {
              name: personName(s.user),
              title: s.title,
              actions: (
                <ConfirmAction
                  action={adminRemoveStaffAction}
                  values={{ universityId: university.id, clubId: club.id, userId: s.user.id }}
                  triggerLabel={t("common.remove")}
                  title={t("club.staff.removeTitle", { name: personName(s.user) })}
                  description={t("club.admin.directBody")}
                  {...confirm}
                />
              ),
            },
          }))}
          empty={<EmptyState title={t("club.staff.empty")} />}
        />
      </section>

      <section className="flex flex-col gap-(--space-3)">
        <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("club.members.title")}</h2>
        <Table
          caption={t("club.members.title")}
          columns={[
            { key: "name", header: t("admin.users.person") },
            { key: "joined", header: t("club.members.joined"), hideBelow: "sm" },
            { key: "actions", header: t("common.actions"), align: "end" },
          ]}
          rows={members.items.map((m) => ({
            id: m.id,
            cells: {
              name: (
                <span className="flex flex-wrap items-center gap-(--space-2)">
                  <span className="font-medium">{personName(m.user)}</span>
                  {m.user.id === club.presidentId ? <Badge tone="brand">{t("club.roles.PRESIDENT")}</Badge> : null}
                  {m.user.staffRoles[0] ? <Badge tone="info">{m.user.staffRoles[0].title}</Badge> : null}
                </span>
              ),
              joined: formatDate(m.joinedAt, locale),
              actions:
                m.user.id === club.presidentId ? null : (
                  <ConfirmAction
                    action={adminRemoveMemberAction}
                    values={{ universityId: university.id, clubId: club.id, userId: m.user.id }}
                    triggerLabel={t("common.remove")}
                    title={t("club.members.removeTitle", { name: personName(m.user) })}
                    description={t("club.admin.directBody")}
                    {...confirm}
                  />
                ),
            },
          }))}
          empty={<EmptyState title={t("club.members.empty")} />}
        />
      </section>
    </>
  );
}

export default function AdminClubDetailPage(props: PageProps<"/panel/admin/kulupler/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
