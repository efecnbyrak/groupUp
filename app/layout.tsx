import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { getLocale, getT } from "@/i18n/server";

import { HtmlLangSync } from "./_components/html-lang";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: "groupUp", description: t("meta.description") };
}

/**
 * `lang` cookie'ye bağlı; cacheComponents altında root layout statik kalmalı.
 * Statik `tr` + akışla gelen dil değeri client'ta `<html lang>`'e yazılır (inline script yok → CSP dostu).
 */
async function HtmlLang() {
  return <HtmlLangSync locale={await getLocale()} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" data-archetype="productive" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={null}>
          <HtmlLang />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
