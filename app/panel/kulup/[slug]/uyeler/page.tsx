import { Search, Users } from "lucide-react";
import { Suspense } from "react";

import { personName } from "@/app/_components/requests";
import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Avatar, Badge, Button, Card, EmptyState, Input, Pagination, Skeleton, Table } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_FILES } from "@/lib/attachments";
import { formatDate } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import { pendingTargetsForClub, REJECT_REASON_MAX, requestMemberBanAction, requestMemberRemoveAction } from "@/modules/approval";
import { listMembers } from "@/modules/club";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("club.nav.members");

async function Content({ params, searchParams }: PageProps<"/panel/kulup/[slug]/uyeler">) {
  const [t, locale, { slug }, sp] = await Promise.all([getT(), getLocale(), params, searchParams]);
  const { club, can } = await requireClubPage(slug);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const [{ items, nextCursor }, pending] = await Promise.all([listMembers(club.id, { q, cursor }), pendingTargetsForClub(club.id)]);
  const pendingFor = (userId: string) => pending.filter((p) => p.targetId === userId && (p.type === "MEMBER_REMOVE" || p.type === "MEMBER_BAN"));
  const base = `/panel/kulup/${club.slug}/uyeler`;
  const president = can("PRESIDENT");
  const evidence = (userId: string) => [
    { type: "hidden" as const, name: "clubId", value: club.id },
    { type: "hidden" as const, name: "userId", value: userId },
    { type: "textarea" as const, name: "reason", label: t("club.members.reason"), hint: t("club.members.reasonHint"), required: true, rows: 4, maxLength: REJECT_REASON_MAX },
    { type: "file" as const, name: "files", label: t("club.members.evidence"), hint: t("approval.attachmentsHint", { max: ATTACHMENT_MAX_FILES }), accept: ATTACHMENT_ACCEPT, multiple: true, required: true },
  ];

  return (
    <>
      <PageHeader title={t("club.nav.members")} description={president ? t("club.members.presidentBody") : t("club.members.body")} />
      <Card padding="sm">
        <form method="get" role="search" className="flex flex-col gap-(--space-3) sm:flex-row sm:items-end">
          <div className="sm:flex-1">
            <Input id="q" name="q" type="search" label={t("admin.users.search")} defaultValue={q} />
          </div>
          <Button type="submit" variant="secondary" icon={<Search aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("admin.users.filter")}
          </Button>
        </form>
      </Card>
      <Table
        caption={t("club.nav.members")}
        columns={[
          { key: "name", header: t("admin.users.person") },
          { key: "joined", header: t("club.members.joined"), hideBelow: "md" },
          ...(president ? [{ key: "actions", header: t("common.actions"), align: "end" as const }] : []),
        ]}
        rows={items.map((m) => {
          const name = personName(m.user);
          const isPresident = m.user.id === club.presidentId;
          const waiting = pendingFor(m.user.id);
          return {
            id: m.id,
            cells: {
              name: (
                <span className="flex items-center gap-(--space-3)">
                  <Avatar name={name} src={publicFileUrl(m.user.profile?.avatarKey)} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-(--space-1)">
                      <span className="truncate font-medium">{name}</span>
                      {isPresident ? <Badge tone="brand">{t("club.roles.PRESIDENT")}</Badge> : null}
                      {m.user.staffRoles[0] ? <Badge tone="info">{m.user.staffRoles[0].title}</Badge> : null}
                      {m.user.type === "ALUMNI" ? <Badge>{t("nav.roles.alumni")}</Badge> : null}
                      {waiting.length ? <Badge tone="warning">{t("club.members.pending")}</Badge> : null}
                    </span>
                    <span className="truncate text-(length:--type-caption) text-fg-secondary">{m.user.email}</span>
                  </span>
                </span>
              ),
              joined: formatDate(m.joinedAt, locale),
              actions:
                president && !isPresident ? (
                  <span className="flex flex-wrap justify-end gap-(--space-2)">
                    <ActionDialog
                      triggerLabel={t("club.members.remove")}
                      title={t("club.members.removeTitle", { name })}
                      description={t("club.members.removeBody")}
                      action={requestMemberRemoveAction}
                      fields={evidence(m.user.id)}
                      submitLabel={t("approval.sendForApproval")}
                      {...formLabels(t)}
                    />
                    <ActionDialog
                      triggerLabel={t("club.members.ban")}
                      title={t("club.members.banTitle", { name })}
                      description={t("club.members.banBody")}
                      action={requestMemberBanAction}
                      submitVariant="danger"
                      fields={[...evidence(m.user.id), { type: "date", name: "until", label: t("club.members.banUntil"), hint: t("club.members.banUntilHint") }]}
                      submitLabel={t("approval.sendForApproval")}
                      {...formLabels(t)}
                    />
                  </span>
                ) : null,
            },
          };
        })}
        empty={<EmptyState icon={<Users aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("club.members.empty")} />}
      />
      <Pagination
        firstHref={cursor ? `${base}${q ? `?q=${encodeURIComponent(q)}` : ""}` : undefined}
        nextHref={nextCursor ? `${base}?${new URLSearchParams({ ...(q ? { q } : {}), sonraki: nextCursor }).toString()}` : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function ClubMembersPage(props: PageProps<"/panel/kulup/[slug]/uyeler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
