import { Search, Users } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Avatar, Badge, Button, Card, EmptyState, Input, Pagination, Select, Skeleton, Table, type BadgeTone } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import { listUniversityUsers, type UserListFilter } from "@/modules/university";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("admin.nav.users");

const TYPES = ["STUDENT", "ALUMNI"] as const;
const STATUSES = ["ACTIVE", "PENDING_VERIFICATION", "PENDING_ALUMNI_REVIEW", "SUSPENDED"] as const;
const statusTone: Record<(typeof STATUSES)[number] | "DELETED", BadgeTone> = {
  ACTIVE: "success",
  PENDING_VERIFICATION: "neutral",
  PENDING_ALUMNI_REVIEW: "warning",
  SUSPENDED: "danger",
  DELETED: "neutral",
};

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

async function Content({ searchParams }: PageProps<"/panel/admin/kullanicilar">) {
  const [t, locale, sp, { university }] = await Promise.all([getT(), getLocale(), searchParams, requireAdminPage()]);
  const filter: UserListFilter = {
    q: typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined,
    type: pick(sp.tip, TYPES),
    status: pick(sp.durum, STATUSES),
    cursor: typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined,
  };
  const { items, nextCursor } = await listUniversityUsers(university.id, filter);
  const query = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: filter.q, tip: filter.type, durum: filter.status, ...extra })) if (v) params.set(k, v);
    const s = params.toString();
    return `/panel/admin/kullanicilar${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title={t("admin.nav.users")} description={t("admin.users.body")} />
      <Card padding="sm">
        <form method="get" role="search" className="flex flex-col gap-(--space-3) sm:flex-row sm:flex-wrap sm:items-end">
          <div className="sm:min-w-0 sm:flex-2">
            <Input id="q" name="q" type="search" label={t("admin.users.search")} placeholder={t("admin.users.searchPlaceholder")} defaultValue={filter.q} />
          </div>
          <div className="sm:flex-1">
            <Select id="tip" label={t("admin.users.type")} defaultValue={filter.type ?? ""} placeholder={t("admin.users.all")} options={TYPES.map((v) => ({ value: v, label: t(`admin.userTypes.${v}`) }))} />
          </div>
          <div className="sm:flex-1">
            <Select id="durum" label={t("admin.users.status")} defaultValue={filter.status ?? ""} placeholder={t("admin.users.all")} options={STATUSES.map((v) => ({ value: v, label: t(`admin.userStatus.${v}`) }))} />
          </div>
          <Button type="submit" variant="secondary" icon={<Search aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("admin.users.filter")}
          </Button>
        </form>
      </Card>
      <Table
        caption={t("admin.nav.users")}
        columns={[
          { key: "name", header: t("admin.users.person") },
          { key: "studentNo", header: t("admin.users.studentNo"), hideBelow: "lg" },
          { key: "department", header: t("admin.users.department"), hideBelow: "md" },
          { key: "type", header: t("admin.users.type"), hideBelow: "sm" },
          { key: "status", header: t("admin.users.status") },
          { key: "joined", header: t("admin.users.joined"), hideBelow: "lg" },
        ]}
        rows={items.map((u) => {
          const name = [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || u.email;
          const department = u.profile?.department ? (locale === "en" && u.profile.department.nameEn) || u.profile.department.nameTr : "—";
          return {
            id: u.id,
            cells: {
              name: (
                <span className="flex items-center gap-(--space-3)">
                  <Avatar name={name} src={publicFileUrl(u.profile?.avatarKey)} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-(length:--type-caption) text-fg-secondary">{u.email}</span>
                  </span>
                </span>
              ),
              studentNo: u.profile?.studentNo ?? "—",
              department,
              type: <Badge tone={u.type === "ALUMNI" ? "warning" : "info"}>{t(`admin.userTypes.${u.type}`)}</Badge>,
              status: <Badge tone={statusTone[u.status]}>{t(`admin.userStatus.${u.status}`)}</Badge>,
              joined: formatDate(u.createdAt, locale),
            },
          };
        })}
        empty={<EmptyState icon={<Users aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("admin.users.empty")} />}
      />
      <Pagination
        firstHref={filter.cursor ? query({}) : undefined}
        nextHref={nextCursor ? query({ sonraki: nextCursor }) : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function AdminUsersPage(props: PageProps<"/panel/admin/kullanicilar">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
