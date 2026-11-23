import type { FormField } from "@/components/ui";
import type { Translate } from "@/i18n/messages";

/** Üniversite ekle/düzenle formunun alanları (iki sayfada ortak). */
export function universityFields(
  t: Translate,
  values: { name?: string; slug?: string; city?: string | null; alumniVerifyMode?: string } = {},
): FormField[] {
  return [
    { type: "text", name: "name", label: t("platform.fields.name"), required: true, maxLength: 150, defaultValue: values.name },
    { type: "text", name: "slug", label: t("platform.fields.slug"), hint: t("platform.fields.slugHint"), maxLength: 80, defaultValue: values.slug },
    { type: "text", name: "city", label: t("platform.fields.city"), maxLength: 80, defaultValue: values.city ?? undefined },
    {
      type: "select",
      name: "alumniVerifyMode",
      label: t("platform.fields.alumniVerifyMode"),
      hint: t("platform.fields.alumniVerifyModeHint"),
      required: true,
      defaultValue: values.alumniVerifyMode ?? "BOTH",
      options: (["BOTH", "DOMAIN", "MANUAL"] as const).map((m) => ({ value: m, label: t(`platform.alumniModes.${m}`) })),
    },
  ];
}
