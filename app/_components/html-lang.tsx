"use client";

import { useEffect } from "react";

/** `<html lang>` cookie'deki dile eşitlenir (root layout statik `tr` ile prerender edilir). */
export function HtmlLangSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
