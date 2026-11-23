import { connection } from "next/server";
import { Ticket } from "lucide-react";
import { Suspense } from "react";

import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionForm, Badge, Card, CardHeader, ConfirmAction, CopyButton, EmptyState, Skeleton, Table, type BadgeTone } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { createInviteAction, INVITE_EXPIRY_OPTIONS, inviteState, listInvites, revokeInviteAction } from "@/modules/club";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("club.nav.invites");

const stateTone: Record<string, BadgeTone> = { VALID: "success", EXPIRED: "neutral", REVOKED: "neutral", USED_UP: "warning" };

/** Davet kodları (Başkan / MEMBER_INVITE): süre 7/30 gün/süresiz (varsayılan 30), limit opsiyonel. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/davetler">) {
  await connection();
  const [t, locale, { slug }] = await Promise.all([getT(), getLocale(), params]);
  const { club } = await requireClubPage(slug, "MEMBER_INVITE");
  const invites = await listInvites(club.id);
  const now = new Date();

  return (
    <>
      <PageHeader title={t("club.nav.invites")} description={t("club.invites.body")} />
      <Card className="flex flex-col gap-(--space-4)">
        <CardHeader title={t("club.invites.create")} />
        <ActionForm
          action={createInviteAction}
          layout="inline"
          fields={[
            { type: "hidden", name: "clubId", value: club.id },
            { type: "select", name: "expiresIn", label: t("club.invites.expiresIn"), defaultValue: "30", options: INVITE_EXPIRY_OPTIONS.map((v) => ({ value: v, label: t(`club.invites.expiry.${v}`) })) },
            { type: "number", name: "maxUses", label: t("club.invites.maxUses"), hint: t("club.invites.maxUsesHint"), min: 1, max: 10000 },
          ]}
          submitLabel={t("club.invites.createSubmit")}
          {...formLabels(t)}
        />
      </Card>
      <Table
        caption={t("club.nav.invites")}
        columns={[
          { key: "code", header: t("club.invites.code") },
          { key: "state", header: t("ticket.statusLabel") },
          { key: "usage", header: t("club.invites.usage"), hideBelow: "sm" },
          { key: "expires", header: t("club.invites.expires"), hideBelow: "md" },
          { key: "actions", header: t("common.actions"), align: "end" },
        ]}
        rows={invites.map((inv) => {
          const state = inviteState(inv, now);
          const link = `${env.APP_URL}/katil/${inv.code}`;
          return {
            id: inv.id,
            cells: {
              code: <span className="font-mono font-semibold tracking-wider">{inv.code}</span>,
              state: <Badge tone={stateTone[state]}>{t(`club.invites.state.${state}`)}</Badge>,
              usage: inv.maxUses ? `${inv.usedCount} / ${inv.maxUses}` : t("club.invites.usageUnlimited", { count: inv.usedCount }),
              expires: inv.expiresAt ? formatDate(inv.expiresAt, locale) : t("club.invites.expiry.never"),
              actions:
                state === "VALID" ? (
                  <span className="flex flex-wrap justify-end gap-(--space-2)">
                    <CopyButton value={link} label={t("club.invites.copyLink")} copiedLabel={t("club.invites.copied")} />
                    <ConfirmAction
                      action={revokeInviteAction}
                      values={{ clubId: club.id, inviteId: inv.id }}
                      triggerLabel={t("club.invites.revoke")}
                      title={t("club.invites.revokeTitle", { code: inv.code })}
                      description={t("club.invites.revokeBody")}
                      {...confirmLabels(t)}
                    />
                  </span>
                ) : null,
            },
          };
        })}
        empty={<EmptyState icon={<Ticket aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("club.invites.empty")} />}
      />
    </>
  );
}

export default function ClubInvitesPage(props: PageProps<"/panel/kulup/[slug]/davetler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
