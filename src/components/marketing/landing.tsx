import { ArrowRight, Check, ChevronDown, FileSpreadsheet, KeyRound, Languages, ListChecks, Mail, ShieldCheck, Trophy, UserPlus, Users, X } from "lucide-react";
import type { ReactNode } from "react";

import type { PanelName } from "@/components/shell";
import { ButtonLink, cn } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { MessageKey, Translate } from "@/i18n/messages";

import { BracketPreview } from "./bracket-preview";
import { DEMO_STATS } from "./demo-data";
import { EventCardMockup } from "./event-card-mockup";

const ic = "size-(--icon-size-md)";

function Section({ id, title, body, muted, children }: { id?: string; title: string; body?: string; muted?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-baslik` : undefined} className={cn("scroll-mt-(--header-height) py-(--section-y-md)", muted && "bg-canvas-subtle")}>
      <div className="mx-auto flex w-full max-w-(--content-width-xl) flex-col gap-(--space-10) px-(--gutter)">
        <div className="flex max-w-(--content-width-md) flex-col gap-(--space-3)">
          <h2 id={id ? `${id}-baslik` : undefined} className="font-display text-heading-xl font-semibold text-fg">
            {title}
          </h2>
          {body ? <p className="text-fg-secondary">{body}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Hero({ t }: { t: Translate }) {
  return (
    <section className="overflow-hidden py-(--section-y-md)">
      <div className="mx-auto grid w-full max-w-(--content-width-xl) items-center gap-(--space-12) px-(--gutter) lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-(--space-6)">
          <p className="text-(length:--type-body-sm) font-semibold text-brand">{t("landing.hero.eyebrow")}</p>
          <h1 className="font-display text-display-xl font-semibold text-balance text-fg">{t("landing.hero.title")}</h1>
          <p className="max-w-(--content-width-sm) text-(length:--type-body-lg) text-fg-secondary">{t("landing.hero.body")}</p>
          <div className="flex flex-wrap gap-(--space-3)">
            <ButtonLink href="/kayit" size="lg" icon={<Mail aria-hidden="true" className={ic} />}>
              {t("landing.hero.ctaPrimary")}
            </ButtonLink>
            <ButtonLink href="#nasil-calisir" size="lg" variant="secondary">
              {t("landing.hero.ctaSecondary")}
            </ButtonLink>
          </div>
        </div>
        <figure aria-label={t("landing.hero.mockupLabel")} className="relative mx-auto w-full max-w-(--popover-width-lg) lg:max-w-none">
          <div className="lg:mr-(--space-24)">
            <EventCardMockup t={t} />
          </div>
          <div className="mt-(--space-4) rounded-card border border-line bg-card p-(--space-4) shadow-(--elevation-md) lg:absolute lg:top-(--space-16) lg:right-0 lg:mt-0 lg:w-1/2">
            <BracketPreview label={t("landing.showcase.label")} semiLabel={t("landing.mockup.bracket")} finalLabel={t("landing.mockup.final")} className="w-full" />
          </div>
        </figure>
      </div>
    </section>
  );
}

function Trust({ t, locale }: { t: Translate; locale: Locale }) {
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB");
  const stats: [number, MessageKey][] = [
    [DEMO_STATS.clubs, "landing.trust.clubs"],
    [DEMO_STATS.events, "landing.trust.events"],
    [DEMO_STATS.applications, "landing.trust.applications"],
    [DEMO_STATS.tournaments, "landing.trust.tournaments"],
  ];
  return (
    <section aria-label={t("landing.trust.title")} className="border-y border-line bg-canvas-subtle py-(--space-10)">
      <div className="mx-auto flex w-full max-w-(--content-width-xl) flex-col items-center gap-(--space-6) px-(--gutter) text-center">
        <p className="font-semibold text-fg">{t("landing.trust.title")}</p>
        <dl className="grid w-full grid-cols-2 gap-(--space-6) md:grid-cols-4">
          {stats.map(([value, key]) => (
            <div key={key} className="flex flex-col-reverse gap-(--space-1)">
              <dt className="text-(length:--type-body-sm) text-fg-secondary">{t(key)}</dt>
              <dd className="font-display text-heading-xl font-semibold text-fg tabular-nums">{nf.format(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-(length:--type-caption) text-fg-tertiary">{t("landing.trust.demoNote")}</p>
      </div>
    </section>
  );
}

function Steps({ t }: { t: Translate }) {
  const steps: [MessageKey, MessageKey, ReactNode][] = [
    ["landing.steps.s1Title", "landing.steps.s1Body", <Mail key="1" aria-hidden="true" className={ic} />],
    ["landing.steps.s2Title", "landing.steps.s2Body", <KeyRound key="2" aria-hidden="true" className={ic} />],
    ["landing.steps.s3Title", "landing.steps.s3Body", <ListChecks key="3" aria-hidden="true" className={ic} />],
  ];
  return (
    <Section id="nasil-calisir" title={t("landing.steps.title")}>
      <ol className="grid gap-(--space-6) md:grid-cols-3">
        {steps.map(([title, body, icon], i) => (
          <li key={title} className="flex flex-col gap-(--space-3)">
            <div className="flex items-center gap-(--space-3)">
              <span className="inline-flex size-(--control-height-md) items-center justify-center rounded-full bg-brand text-on-brand">{icon}</span>
              <span className="text-(length:--type-body-sm) font-semibold text-fg-secondary tabular-nums">0{i + 1}</span>
            </div>
            <h3 className="text-(length:--type-heading-md) font-semibold text-fg">{t(title)}</h3>
            <p className="text-fg-secondary">{t(body)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Features({ t }: { t: Translate }) {
  const items: [MessageKey, MessageKey, ReactNode][] = [
    ["landing.features.f1Title", "landing.features.f1Body", <ListChecks key="1" aria-hidden="true" className={ic} />],
    ["landing.features.f2Title", "landing.features.f2Body", <UserPlus key="2" aria-hidden="true" className={ic} />],
    ["landing.features.f3Title", "landing.features.f3Body", <Trophy key="3" aria-hidden="true" className={ic} />],
    ["landing.features.f4Title", "landing.features.f4Body", <FileSpreadsheet key="4" aria-hidden="true" className={ic} />],
    ["landing.features.f5Title", "landing.features.f5Body", <ShieldCheck key="5" aria-hidden="true" className={ic} />],
    ["landing.features.f6Title", "landing.features.f6Body", <Languages key="6" aria-hidden="true" className={ic} />],
  ];
  return (
    <Section id="ozellikler" title={t("landing.features.title")} body={t("landing.features.body")} muted>
      <ul className="grid gap-(--space-4) sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([title, body, icon]) => (
          <li key={title} className="flex flex-col gap-(--space-3) rounded-card border border-line bg-card p-(--space-6)">
            <span className="inline-flex size-(--control-height-md) items-center justify-center rounded-control bg-brand-subtle text-brand">{icon}</span>
            <h3 className="text-(length:--type-heading-sm) font-semibold text-fg">{t(title)}</h3>
            <p className="text-(length:--type-body-sm) text-fg-secondary">{t(body)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ForClubs({ t }: { t: Translate }) {
  const rows = (["1", "2", "3", "4"] as const).map((n) => [t(`landing.forClubs.b${n}`), t(`landing.forClubs.a${n}`)] as const);
  return (
    <Section id="kulupler-icin" title={t("landing.forClubs.title")} body={t("landing.forClubs.body")}>
      <div className="grid gap-(--space-4) md:grid-cols-2">
        <div className="flex flex-col gap-(--space-4) rounded-card border border-line bg-canvas-subtle p-(--space-6)">
          <h3 className="text-(length:--type-heading-sm) font-semibold text-fg-secondary">{t("landing.forClubs.before")}</h3>
          <ul className="flex flex-col gap-(--space-3)">
            {rows.map(([before]) => (
              <li key={before} className="flex items-start gap-(--space-3) text-fg-secondary">
                <X aria-hidden="true" className="mt-(--space-1) size-(--icon-size-sm) shrink-0 text-negative" />
                {before}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-(--space-4) rounded-card border border-brand bg-card p-(--space-6)">
          <h3 className="text-(length:--type-heading-sm) font-semibold text-brand">{t("landing.forClubs.after")}</h3>
          <ul className="flex flex-col gap-(--space-3)">
            {rows.map(([, after]) => (
              <li key={after} className="flex items-start gap-(--space-3) text-fg">
                <Check aria-hidden="true" className="mt-(--space-1) size-(--icon-size-sm) shrink-0 text-positive" />
                {after}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Roles({ t }: { t: Translate }) {
  const roles: [PanelName, MessageKey, MessageKey][] = [
    ["student", "nav.roles.student", "landing.roles.studentBody"],
    ["alumni", "nav.roles.alumni", "landing.roles.alumniBody"],
    ["president", "nav.roles.president", "landing.roles.presidentBody"],
    ["admin", "nav.roles.admin", "landing.roles.adminBody"],
  ];
  return (
    <Section id="roller" title={t("landing.roles.title")} body={t("landing.roles.body")} muted>
      <ul className="grid gap-(--space-4) sm:grid-cols-2 lg:grid-cols-4">
        {roles.map(([panel, title, body]) => (
          <li key={panel} data-panel={panel} className="flex flex-col overflow-hidden rounded-card border border-line bg-card">
            <span aria-hidden="true" className="h-(--panel-stripe-height) bg-brand" />
            <div className="flex flex-col gap-(--space-2) p-(--space-6)">
              <h3 className="flex items-center gap-(--space-2) text-(length:--type-heading-sm) font-semibold text-brand">
                <Users aria-hidden="true" className="size-(--icon-size-sm)" />
                {t(title)}
              </h3>
              <p className="text-(length:--type-body-sm) text-fg-secondary">{t(body)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Showcase({ t }: { t: Translate }) {
  return (
    <Section id="turnuva" title={t("landing.showcase.title")} body={t("landing.showcase.body")}>
      <div className="rounded-card border border-line bg-card p-(--space-6) md:p-(--space-10)">
        <BracketPreview label={t("landing.showcase.label")} semiLabel={t("landing.mockup.bracket")} finalLabel={t("landing.mockup.final")} className="mx-auto w-full max-w-(--content-width-sm)" />
      </div>
    </Section>
  );
}

function Faq({ t }: { t: Translate }) {
  const items = (["1", "2", "3", "4", "5", "6"] as const).map((n) => [t(`landing.faq.q${n}`), t(`landing.faq.a${n}`)] as const);
  return (
    <Section id="sss" title={t("landing.faq.title")} muted>
      <div className="max-w-(--content-width-md) divide-y divide-line rounded-card border border-line bg-card">
        {items.map(([q, a]) => (
          <details key={q} className="group px-(--space-6)">
            <summary className="flex min-h-(--touch-target-min) cursor-pointer list-none items-center justify-between gap-(--space-4) py-(--space-4) font-semibold text-fg [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown aria-hidden="true" className="size-(--icon-size-md) shrink-0 text-fg-secondary transition-transform duration-(--duration-base) group-open:rotate-180" />
            </summary>
            <p className="pb-(--space-4) text-fg-secondary">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function FinalCta({ t }: { t: Translate }) {
  return (
    <section className="py-(--section-y-md)">
      <div className="mx-auto w-full max-w-(--content-width-xl) px-(--gutter)">
        <div className="flex flex-col items-start gap-(--space-6) rounded-card bg-inverse p-(--space-8) md:flex-row md:items-center md:justify-between md:p-(--space-12)">
          <div className="flex flex-col gap-(--space-2)">
            <h2 className="font-display text-heading-xl font-semibold text-(--color-text-inverse)">{t("landing.cta.title")}</h2>
            <p className="text-(--color-text-inverse) opacity-80">{t("landing.cta.body")}</p>
          </div>
          <ButtonLink href="/kayit" size="lg" variant="secondary" icon={<ArrowRight aria-hidden="true" className={ic} />}>
            {t("landing.cta.button")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** Landing (DESIGN §5) — tamamı Server Component; JS yalnızca header/footer'daki küçük adalar. */
export function Landing({ t, locale }: { t: Translate; locale: Locale }) {
  return (
    <>
      <Hero t={t} />
      <Trust t={t} locale={locale} />
      <Steps t={t} />
      <Features t={t} />
      <ForClubs t={t} />
      <Roles t={t} />
      <Showcase t={t} />
      <Faq t={t} />
      <FinalCta t={t} />
    </>
  );
}
