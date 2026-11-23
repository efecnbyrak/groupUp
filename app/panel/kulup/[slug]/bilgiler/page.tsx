import { Suspense } from "react";

import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionForm, Alert, Card, Skeleton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { ATTACHMENT_ACCEPT } from "@/lib/attachments";
import { pendingTargetsForClub, requestClubUpdateAction } from "@/modules/approval";
import { getClubInfo } from "@/modules/club";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("club.nav.info");
const IMAGE_ACCEPT = ATTACHMENT_ACCEPT.replace("application/pdf,", "");

/** Kulüp bilgileri (yalnızca Başkan): değişiklik CLUB_UPDATE talebi olarak Admin onayına gider; ad değiştirilemez. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/bilgiler">) {
  const [t, { slug }] = await Promise.all([getT(), params]);
  const { club } = await requireClubPage(slug, "PRESIDENT");
  const [info, pending] = await Promise.all([getClubInfo(club.id), pendingTargetsForClub(club.id)]);
  const waiting = pending.some((p) => p.type === "CLUB_UPDATE");
  return (
    <>
      <PageHeader title={t("club.nav.info")} description={t("club.info.body")} />
      {waiting ? <Alert tone="info">{t("club.info.pending")}</Alert> : null}
      <Card className="max-w-(--content-width-md)">
        <ActionForm
          action={requestClubUpdateAction}
          fields={[
            { type: "hidden", name: "clubId", value: club.id },
            { type: "textarea", name: "shortDescTr", label: t("club.fields.shortDesc"), required: true, maxLength: 200, rows: 3, defaultValue: info.shortDescTr },
            { type: "textarea", name: "description", label: t("club.fields.description"), hint: t("club.fields.descriptionHint"), maxLength: 2000, rows: 8, defaultValue: info.description ?? undefined },
            { type: "email", name: "contactEmail", label: t("club.fields.contactEmail"), defaultValue: info.contactEmail ?? undefined },
            { type: "text", name: "instagram", label: t("club.fields.instagram"), placeholder: "@kulup", maxLength: 31, defaultValue: info.instagram ?? undefined },
            { type: "file", name: "logo", label: t("club.fields.logo"), hint: t("club.fields.imageHint"), accept: IMAGE_ACCEPT },
            { type: "file", name: "cover", label: t("club.fields.cover"), hint: t("club.fields.imageHint"), accept: IMAGE_ACCEPT },
          ]}
          submitLabel={t("approval.sendForApproval")}
          {...formLabels(t)}
        />
      </Card>
    </>
  );
}

export default function ClubInfoPage(props: PageProps<"/panel/kulup/[slug]/bilgiler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
