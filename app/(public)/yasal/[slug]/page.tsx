import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

const SLUGS = ["kvkk", "gizlilik", "kullanim-sartlari", "iletisim"] as const;
type Slug = (typeof SLUGS)[number];
const KEY_BY_SLUG: Record<Slug, string> = {
  kvkk: "kvkk",
  gizlilik: "gizlilik",
  "kullanim-sartlari": "kullanimSartlari",
  iletisim: "iletisim",
};

interface Section {
  heading: string;
  body: string[];
}

async function LegalContent({ slug }: { slug: Slug }) {
  const t = (await getTranslations("legal")) as unknown as { (key: string): string; raw: (key: string) => unknown };
  const key = KEY_BY_SLUG[slug];
  const title = t(`${key}.title`);
  const updatedAt = t(`${key}.updatedAt`);
  const sections = t.raw(`${key}.sections`) as Section[];
  return (
    <>
      <h1 className="font-display text-heading-xl font-semibold text-fg">{title}</h1>
      <p className="text-(length:--type-body-sm) text-fg-secondary">{updatedAt}</p>
      <div className="flex flex-col gap-(--space-6)">
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-(--space-2)">
            <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-fg-secondary">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUGS.includes(slug as Slug)) notFound();
  return (
    <div className="mx-auto flex w-full max-w-(--content-width-md) flex-col gap-(--space-6) px-(--gutter) py-(--space-12)">
      <Suspense fallback={null}>
        <LegalContent slug={slug as Slug} />
      </Suspense>
    </div>
  );
}

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}
