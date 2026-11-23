import { UserCog } from "lucide-react";
import { Suspense } from "react";

import { personName } from "@/app/_components/requests";
import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Alert, Avatar, Badge, EmptyState, Skeleton, Table, type FormField } from "@/components/ui";
import type { Translate } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import { MAX_STAFF, STAFF_PERMISSIONS, type StaffPermissionName } from "@/lib/club-roles";
import { publicFileUrl } from "@/lib/storage";
import { pendingTargetsForClub, requestStaffAssignAction, requestStaffRemoveAction } from "@/modules/approval";
import { listStaff, listStaffCandidates } from "@/modules/club";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("club.nav.staff");

const permissionFields = (t: Translate, current: readonly string[] = []): FormField[] =>
  STAFF_PERMISSIONS.map((p) => ({ type: "checkbox" as const, name: `perm_${p}`, label: t(`club.permissions.${p}`), hint: t(`club.permissionHints.${p}`), defaultChecked: current.includes(p) }));

/** Ekip (Başkan + en fazla 9 görevli). Atama/güncelleme/çıkarma Admin onayına gider. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/ekip">) {
  const [t, { slug }] = await Promise.all([getT(), params]);
  const { club, can } = await requireClubPage(slug);
  const president = can("PRESIDENT");
  const [staff, candidates, pending] = await Promise.all([listStaff(club.id), president ? listStaffCandidates(club.id, club.presidentId) : Promise.resolve([]), pendingTargetsForClub(club.id)]);
  const pendingAssign = pending.filter((p) => p.type === "STAFF_ASSIGN").map((p) => p.targetId);
  const pendingRemove = pending.filter((p) => p.type === "STAFF_REMOVE").map((p) => p.targetId);
  const staffIds = new Set(staff.map((s) => s.user.id));
  const used = staff.length + new Set(pendingAssign.filter((id) => !staffIds.has(id))).size;
  const full = used >= MAX_STAFF;
  const labels = formLabels(t);
  const permissionList = (perms: readonly StaffPermissionName[]) => (perms.length ? perms.map((p) => t(`club.permissions.${p}`)).join(", ") : t("club.staff.noPermissions"));

  return (
    <>
      <PageHeader
        title={t("club.nav.staff")}
        description={t("club.staff.body", { used, max: MAX_STAFF })}
        action={
          president && !full && candidates.length > 0 ? (
            <ActionDialog
              triggerLabel={t("club.staff.add")}
              triggerVariant="primary"
              triggerSize="md"
              title={t("club.staff.add")}
              description={t("club.staff.addBody")}
              action={requestStaffAssignAction}
              fields={[
                { type: "hidden", name: "clubId", value: club.id },
                { type: "select", name: "userId", label: t("club.staff.member"), required: true, placeholder: t("common.select"), options: candidates.map((c) => ({ value: c.user.id, label: `${personName(c.user)} · ${c.user.email}` })) },
                { type: "text", name: "title", label: t("club.staff.titleField"), hint: t("club.staff.titleHint"), required: true, maxLength: 60 },
                ...permissionFields(t),
              ]}
              submitLabel={t("approval.sendForApproval")}
              {...labels}
            />
          ) : null
        }
      />
      {president && full ? <Alert tone="warning">{t("club.errors.staffLimit")}</Alert> : null}
      {president && pendingAssign.length ? <Alert tone="info">{t("club.staff.pendingInfo", { count: pendingAssign.length })}</Alert> : null}
      <Table
        caption={t("club.nav.staff")}
        columns={[
          { key: "name", header: t("admin.users.person") },
          { key: "title", header: t("club.staff.titleField") },
          { key: "perms", header: t("club.staff.permissions"), hideBelow: "lg" },
          ...(president ? [{ key: "actions", header: t("common.actions"), align: "end" as const }] : []),
        ]}
        rows={staff.map((s) => {
          const name = personName(s.user);
          return {
            id: s.id,
            cells: {
              name: (
                <span className="flex items-center gap-(--space-3)">
                  <Avatar name={name} src={publicFileUrl(s.user.profile?.avatarKey)} size="sm" />
                  <span className="truncate font-medium">{name}</span>
                  {pendingRemove.includes(s.user.id) || pendingAssign.includes(s.user.id) ? <Badge tone="warning">{t("club.members.pending")}</Badge> : null}
                </span>
              ),
              title: s.title,
              perms: <span className="text-(length:--type-caption) text-fg-secondary">{permissionList(s.permissions)}</span>,
              actions: president ? (
                <span className="flex flex-wrap justify-end gap-(--space-2)">
                  <ActionDialog
                    triggerLabel={t("common.edit")}
                    title={t("club.staff.editTitle", { name })}
                    description={t("club.staff.addBody")}
                    action={requestStaffAssignAction}
                    fields={[
                      { type: "hidden", name: "clubId", value: club.id },
                      { type: "hidden", name: "userId", value: s.user.id },
                      { type: "text", name: "title", label: t("club.staff.titleField"), required: true, maxLength: 60, defaultValue: s.title },
                      ...permissionFields(t, s.permissions),
                    ]}
                    submitLabel={t("approval.sendForApproval")}
                    {...labels}
                  />
                  <ActionDialog
                    triggerLabel={t("common.remove")}
                    title={t("club.staff.removeTitle", { name })}
                    description={t("club.staff.removeBody")}
                    action={requestStaffRemoveAction}
                    submitVariant="danger"
                    fields={[
                      { type: "hidden", name: "clubId", value: club.id },
                      { type: "hidden", name: "userId", value: s.user.id },
                      { type: "textarea", name: "reason", label: t("club.staff.reasonOptional"), rows: 3, maxLength: 500 },
                    ]}
                    submitLabel={t("approval.sendForApproval")}
                    {...labels}
                  />
                </span>
              ) : null,
            },
          };
        })}
        empty={<EmptyState icon={<UserCog aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("club.staff.empty")} description={president ? t("club.staff.emptyBody") : undefined} />}
      />
    </>
  );
}

export default function ClubStaffPage(props: PageProps<"/panel/kulup/[slug]/ekip">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
