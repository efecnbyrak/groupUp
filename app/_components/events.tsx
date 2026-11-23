import { Badge, EventCard, type BadgeTone } from "@/components/ui";
import type { MessageKey, Translate } from "@/i18n/messages";
import { formatEventDateTime } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import { countdown, pick, registrationState, variantKey, type EventCardData, type RegistrationState } from "@/modules/event";

/** Etkinlik sunumu ortak yardımcıları (feed, Keşfet, kulüp sayfası, kulüp paneli). */
const stateTone: Record<RegistrationState, BadgeTone> = { NOT_OPEN: "neutral", OPEN: "success", CLOSING_SOON: "warning", FULL: "danger", WAITLIST: "warning", CLOSED: "neutral" };

export function registrationBadge(t: Translate, state: RegistrationState): { label: string; tone: BadgeTone } {
  return { label: t(`event.registration.${state}` as MessageKey), tone: stateTone[state] };
}

const statusTone: Record<string, BadgeTone> = { DRAFT: "neutral", PENDING: "warning", PUBLISHED: "success", CANCELLED: "danger", COMPLETED: "info" };

export function EventStatusBadge({ status, t }: { status: string; t: Translate }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{t(`event.status.${status}` as MessageKey)}</Badge>;
}

export function countdownLabel(t: Translate, to: Date | null, now: Date): string | undefined {
  const c = to ? countdown(to, now) : null;
  if (!c) return undefined;
  if (c.days > 0) return t("event.countdown.days", { days: c.days, hours: c.hours });
  return t("event.countdown.hours", { hours: c.hours, minutes: c.minutes });
}

export function eventTitle(e: { titleTr: string; titleEn: string | null }, locale: string): string {
  return pick(locale, e.titleTr, e.titleEn) || "—";
}

export function EventGrid({ events, t, locale, now, hrefFor, showStatus }: { events: EventCardData[]; t: Translate; locale: string; now: Date; hrefFor?: (id: string) => string; showStatus?: boolean }) {
  return (
    <ul className="grid grid-cols-1 gap-(--space-4) sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => {
        const state = registrationState(e, now);
        const open = state === "OPEN" || state === "CLOSING_SOON" || state === "WAITLIST";
        return (
          <li key={e.id}>
            <EventCard
              href={hrefFor ? hrefFor(e.id) : `/etkinlikler/${e.id}`}
              title={eventTitle(e, locale)}
              coverUrl={e.coverKey ? publicFileUrl(variantKey(e.coverKey, 400)) : null}
              clubName={e.club.name}
              clubLogoUrl={publicFileUrl(e.club.logoKey)}
              category={locale === "en" ? e.category.nameEn : e.category.nameTr}
              dateLabel={e.startAt ? formatEventDateTime(e.startAt, locale) : t("event.noDate")}
              location={e.isOnline ? t("event.online") : (e.locationName ?? "—")}
              online={e.isOnline}
              team={e.mode === "TEAM"}
              modeLabel={t(`event.mode.${e.mode}` as MessageKey)}
              status={showStatus ? { label: t(`event.status.${e.status}` as MessageKey), tone: statusTone[e.status] ?? "neutral" } : registrationBadge(t, state)}
              countdown={open ? countdownLabel(t, e.applyClosesAt, now) : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Etkinlik kategori seçimi: alt kategoriler üst başlık altında; alt kategorisi olmayan üst kategori kendisi seçilir. */
export function eventCategoryOptions(
  tree: { id: string; nameTr: string; nameEn: string; children: { id: string; nameTr: string; nameEn: string }[] }[],
  locale: string,
): { options: { value: string; label: string; group?: string }[]; leafIds: string[] } {
  const name = (c: { nameTr: string; nameEn: string }) => (locale === "en" ? c.nameEn : c.nameTr);
  const options: { value: string; label: string; group?: string }[] = [];
  const leafIds: string[] = [];
  for (const p of tree) {
    if (p.children.length === 0) {
      options.push({ value: p.id, label: name(p) });
      leafIds.push(p.id);
    } else
      for (const c of p.children) {
        options.push({ value: c.id, label: name(c), group: name(p) });
        leafIds.push(c.id);
      }
  }
  return { options, leafIds };
}
