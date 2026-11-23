import { AtSign, CheckCircle2, LayoutDashboard, Mail, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { EventGrid } from "@/app/_components/events";
import { personName } from "@/app/_components/requests";
import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { ActionForm, Alert, Avatar, Badge, ButtonLink, Card, ConfirmAction, RichText, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { getClubAccess, getSessionUser } from "@/lib/authz";
import { canOpenClubPanel } from "@/lib/club-roles";
import { formatDateTime } from "@/lib/dates";
import { renderRichText } from "@/lib/rich-text/sanitize";
import { publicFileUrl } from "@/lib/storage";
import { docParagraphs, getClubPublic, getMembership, isBanActive, joinClubAction, leaveClubAction, listMembers } from "@/modules/club";
import { listClubAnnouncements, listClubPublicEvents, pick } from "@/modules/event";

export async function generateMetadata({ params }: PageProps<"/kulupler/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubPublic(slug);
  return { title: club ? `${club.name} — groupUp` : "groupUp", description: club?.shortDescTr };
}

/**
 * Kulüp sayfası — herkese açık (kullanıcı kararı): ad, logo, kategori, açıklama, başkan, üye sayısı.
 * Üye listesi ve katılma yalnızca aynı üniversitenin giriş yapmış kullanıcısına.
 */
async function Content({ params, searchParams }: PageProps<"/kulupler/[slug]">) {
  await connection();
  const [t, locale, { slug }, sp, viewer] = await Promise.all([getT(), getLocale(), params, searchParams, getSessionUser()]);
  const club = await getClubPublic(slug);
  if (!club) notFound();
  const user = viewer?.emailVerified && viewer.status === "ACTIVE" ? viewer : null;
  const insider = user?.universityId === club.universityId;
  const [membership, access, members] = await Promise.all([
    user && insider ? getMembership(club.id, user.id) : null,
    user && insider ? getClubAccess(user, club.id) : null,
    insider ? listMembers(club.id) : null,
  ]);
  const isMember = membership?.status === "ACTIVE";
  const now = new Date();
  const [events, announcements] = await Promise.all([listClubPublicEvents(club.id, now), isMember || (access && canOpenClubPanel(access)) ? listClubAnnouncements(club.id, 5) : []]);
  const banned = membership ? isBanActive(membership, new Date()) : false;
  const description = docParagraphs((locale === "en" && club.descriptionEn) || club.descriptionTr);
  const presidentName = club.president?.profile ? `${club.president.profile.firstName} ${club.president.profile.lastName}` : t("club.noPresident");
  const cover = publicFileUrl(club.coverKey);

  return (
    <article className="flex flex-col gap-(--space-6)">
      {sp.katildi === "1" && isMember ? <Alert tone="success">{t("club.join.welcome", { club: club.name })}</Alert> : null}
      <Card padding="none" className="overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- kapak sharp ile 1600×600 WebP hazırlanır
          <img src={cover} alt="" className="aspect-8/3 w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="aspect-8/3 w-full bg-brand-subtle" />
        )}
        <div className="flex flex-col gap-(--space-4) p-(--space-4) sm:p-(--space-6)">
          <div className="flex flex-col gap-(--space-4) sm:flex-row sm:items-end">
            <Avatar name={club.name} src={publicFileUrl(club.logoKey)} size="lg" shape="square" className="-mt-(--space-12) border-(length:--border-width-strong) border-card" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--space-1)">
              <h1 className="text-(length:--type-heading-xl) font-semibold break-words text-fg">{club.name}</h1>
              <div className="flex flex-wrap items-center gap-(--space-2) text-(length:--type-body-sm) text-fg-secondary">
                <Badge>{locale === "en" ? club.category.nameEn : club.category.nameTr}</Badge>
                <span>{club.university.name}</span>
                <span className="inline-flex items-center gap-(--space-1)">
                  <Users aria-hidden="true" className="size-(--icon-size-sm)" />
                  {t("club.memberCount", { count: club._count.memberships })}
                </span>
              </div>
            </div>
            {access && canOpenClubPanel(access) ? (
              <ButtonLink href={`/panel/kulup/${club.slug}`} variant="secondary" icon={<LayoutDashboard aria-hidden="true" className="size-(--icon-size-sm)" />}>
                {t("nav.clubPanel")}
              </ButtonLink>
            ) : null}
          </div>
          <p className="text-(length:--type-body) text-fg">{(locale === "en" && club.shortDescEn) || club.shortDescTr}</p>
        </div>
      </Card>

      <div className="grid gap-(--space-6) lg:grid-cols-3">
        <div className="flex flex-col gap-(--space-6) lg:col-span-2">
          <Card className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("club.page.about")}</h2>
            {description.length ? (
              description.map((p, i) => (
                <p key={i} className="max-w-(--content-width-prose) whitespace-pre-line text-fg-secondary">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-fg-secondary">{t("club.page.noDescription")}</p>
            )}
          </Card>
          <section aria-labelledby="club-events" className="flex flex-col gap-(--space-3)">
            <h2 id="club-events" className="text-(length:--type-heading-sm) font-semibold text-fg">
              {t("club.page.events")}
            </h2>
            {events.length ? <EventGrid events={events} t={t} locale={locale} now={now} /> : <p className="text-fg-secondary">{t("club.page.noEvents")}</p>}
          </section>
          {announcements.length ? (
            <Card className="flex flex-col gap-(--space-3)">
              <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("feed.announcements")}</h2>
              <ul className="flex flex-col gap-(--space-4)">
                {announcements.map((a) => (
                  <li key={a.id} className="flex flex-col gap-(--space-1)">
                    <h3 className="font-semibold break-words text-fg">{pick(locale, a.titleTr, a.titleEn)}</h3>
                    <p className="text-(length:--type-caption) text-fg-secondary">{formatDateTime(a.createdAt, locale)}</p>
                    <RichText sanitizedHtml={renderRichText(pick(locale, a.bodyTr, a.bodyEn))} className="text-(length:--type-body-sm) text-fg-secondary" />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {members ? (
            <Card className="flex flex-col gap-(--space-3)">
              <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("club.members.title")}</h2>
              <ul className="grid grid-cols-1 gap-(--space-3) sm:grid-cols-2">
                {members.items.map((m) => (
                  <li key={m.id} className="flex min-w-0 items-center gap-(--space-2)">
                    <Avatar name={personName(m.user)} src={publicFileUrl(m.user.profile?.avatarKey)} size="sm" />
                    <span className="truncate text-(length:--type-body-sm) text-fg">{personName(m.user)}</span>
                    {m.user.staffRoles[0] ? <Badge tone="info">{m.user.staffRoles[0].title}</Badge> : null}
                  </li>
                ))}
              </ul>
              {members.nextCursor ? <p className="text-(length:--type-caption) text-fg-secondary">{t("club.page.moreMembers")}</p> : null}
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-(--space-4)">
          <Card className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-body) font-semibold text-fg">{t("club.fields.president")}</h2>
            <div className="flex items-center gap-(--space-3)">
              <Avatar name={presidentName} src={publicFileUrl(club.president?.profile?.avatarKey)} />
              <span className="font-semibold text-fg">{presidentName}</span>
            </div>
            {club.contactEmail ? (
              <a href={`mailto:${club.contactEmail}`} className="inline-flex items-center gap-(--space-2) text-(length:--type-body-sm) text-link hover:underline">
                <Mail aria-hidden="true" className="size-(--icon-size-sm)" />
                <span className="break-all">{club.contactEmail}</span>
              </a>
            ) : null}
            {club.instagram ? (
              <a href={`https://instagram.com/${club.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-(--space-2) text-(length:--type-body-sm) text-link hover:underline">
                <AtSign aria-hidden="true" className="size-(--icon-size-sm)" />
                {club.instagram}
              </a>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-body) font-semibold text-fg">{t("club.page.membership")}</h2>
            {!user ? (
              <>
                <p className="text-(length:--type-body-sm) text-fg-secondary">{t("club.page.loginToJoin")}</p>
                <ButtonLink href={`/giris?next=${encodeURIComponent(`/kulupler/${club.slug}`)}`}>{t("public.login")}</ButtonLink>
              </>
            ) : !insider ? (
              <p className="text-(length:--type-body-sm) text-fg-secondary">{t("club.errors.otherUniversity")}</p>
            ) : isMember ? (
              <>
                <p className="inline-flex items-center gap-(--space-2) font-semibold text-positive">
                  <CheckCircle2 aria-hidden="true" className="size-(--icon-size-md)" />
                  {t("club.page.youAreMember")}
                </p>
                {club.president && access?.role !== "PRESIDENT" ? (
                  <ConfirmAction
                    action={leaveClubAction}
                    values={{ clubId: club.id }}
                    triggerLabel={t("club.leave.button")}
                    title={t("club.leave.title", { club: club.name })}
                    description={t("club.leave.body")}
                    {...confirmLabels(t)}
                  />
                ) : access?.role === "PRESIDENT" ? (
                  <p className="text-(length:--type-caption) text-fg-secondary">{t("club.errors.presidentCannotLeave")}</p>
                ) : null}
              </>
            ) : banned ? (
              <Alert tone="danger">{t("club.errors.banned")}</Alert>
            ) : (
              <>
                <p className="text-(length:--type-body-sm) text-fg-secondary">{t("club.page.joinWithCode")}</p>
                <ActionForm
                  action={joinClubAction}
                  fields={[{ type: "text", name: "code", label: t("club.join.code"), required: true, maxLength: 12, autoComplete: "off", placeholder: "ABCD2345" }]}
                  submitLabel={t("club.join.button")}
                  {...formLabels(t)}
                />
              </>
            )}
          </Card>
        </aside>
      </div>
    </article>
  );
}

export default function ClubPage(props: PageProps<"/kulupler/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
