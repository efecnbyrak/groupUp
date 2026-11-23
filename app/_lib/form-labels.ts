import type { Translate } from "@/i18n/messages";

/** ActionForm / ActionDialog / ConfirmAction'ın ortak çevrilmiş metinleri. */
export function formLabels(t: Translate) {
  return { closeLabel: t("common.close"), loadingLabel: t("common.loading"), cancelLabel: t("common.cancel") };
}

/** Silme/kaldırma onayı için ortak metinler. */
export function confirmLabels(t: Translate) {
  return { ...formLabels(t), confirmLabel: t("common.confirm") };
}
