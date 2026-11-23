import { connection } from "next/server";
import { Ticket } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { formLabels } from "@/app/_lib/form-labels";
import { ActionForm, Alert, Avatar, Badge, ButtonLink, Card, EmptyState, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { getSessionUser } from "@/lib/authz";
import { publicFileUrl } from "@/lib/storage";
import { getMembership, joinClubAction, previewInvite } from "@/modules/club";

export const generateMetadata = titled("club.join.title");

/**
 * Davet linki: GET yalnızca önizler, katılım düğmeyle (POST, CSRF korumalı Server Action).
 * Oturum yoksa girişe yönlendirir ve geri döner.
 */
async function Content({ params }: PageProps<"/katil/[kod]">) {
  await connection();
  const [t, locale, { kod }, viewer] = await Promise.all([getT(), getLocale(), params, getSessionUser()]);
  const invite = await previewInvite(decodeURIComponent(kod));
  if (!invite) {
    return (
      <>
        <h1 className="text-(length:--type-heading-lg) font-semibold text-fg">{t("club.join.title")}</h1>
        <EmptyState icon={<Ticket aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("club.errors.inviteInvalid")} description={t("club.join.invalidBody")} />
      </>
    );
  }
  const { club } = invite;
  const user = viewer?.emailVerified && viewer.status === "ACTIVE" ? viewer : null;
  const membership = user && user.universityId === club.universityId ? await getMembership(club.id, user.id) : null;

  let body: React.ReactNode;
  if (invite.state !== "VALID") body = <Alert tone="warning">{t(`club.invites.stateLong.${invite.state}`)}</Alert>;
  else if (!user)
    body = (
      <>
        <p className="text-fg-secondary">{t("club.join.loginFirst")}</p>
        <ButtonLink href={`/giris?next=${encodeURIComponent(`/katil/${invite.code}`)}`} block>
          {t("public.login")}
        </ButtonLink>
        <ButtonLink href="/kayit" variant="secondary" block>
          {t("public.register")}
        </ButtonLink>
      </>
    );
  else if (user.universityId !== club.universityId) body = <Alert tone="warning">{t("club.errors.otherUniversity")}</Alert>;
  else if (membership?.status === "ACTIVE")
    body = (
      <>
        <Alert tone="success">{t("club.errors.alreadyMember")}</Alert>
        <ButtonLink href={`/kulupler/${club.slug}`} block>
          {t("club.join.goToClub")}
        </ButtonLink>
      </>
    );
  else
    body = (
      <ActionForm
        action={joinClubAction}
        fields={[
          { type: "hidden", name: "code", value: invite.code },
          { type: "hidden", name: "via", value: "link" },
        ]}
        submitLabel={t("club.join.button")}
        {...formLabels(t)}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-(--content-width-sm) flex-col gap-(--space-6)">
      <h1 className="text-(length:--type-heading-lg) font-semibold text-fg">{t("club.join.title")}</h1>
      <Card className="flex flex-col gap-(--space-4)">
        <div className="flex items-center gap-(--space-4)">
          <Avatar name={club.name} src={publicFileUrl(club.logoKey)} size="lg" shape="square" />
          <div className="flex min-w-0 flex-col gap-(--space-1)">
            <h2 className="text-(length:--type-heading-sm) font-semibold break-words text-fg">{club.name}</h2>
            <div className="flex flex-wrap items-center gap-(--space-2) text-(length:--type-caption) text-fg-secondary">
              <Badge>{locale === "en" ? club.category.nameEn : club.category.nameTr}</Badge>
              <span>{club.university.name}</span>
              <span>{t("club.memberCount", { count: club._count.memberships })}</span>
            </div>
          </div>
        </div>
        <p className="text-fg-secondary">{(locale === "en" && club.shortDescEn) || club.shortDescTr}</p>
        {body}
      </Card>
    </div>
  );
}

export default function JoinPage(props: PageProps<"/katil/[kod]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
