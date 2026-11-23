import { Badge, type BadgeTone, type DiffViewRow } from "@/components/ui";
import type { MessageKey, Translate } from "@/i18n/messages";
import { formatDate } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import type { DiffRow, DiffValue } from "@/modules/approval";

/** Onay talepleri ortak sunumu (Admin kuyruğu, kulüp paneli "Talepler"). */
const statusTone: Record<string, BadgeTone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral" };

export function RequestStatusBadge({ status, t }: { status: string; t: Translate }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{t(`approval.status.${status}` as MessageKey)}</Badge>;
}

export function requestTypeLabel(t: Translate, type: string): string {
  return t(`approval.types.${type}` as MessageKey);
}

const IMAGE_FIELDS = new Set(["logoKey", "coverKey"]);

function renderValue(t: Translate, locale: string, field: string, value: DiffValue): React.ReactNode {
  if (value === null) return <span className="text-fg-secondary">{t("approval.diff.empty")}</span>;
  if (IMAGE_FIELDS.has(field) && typeof value === "string") {
    const url = publicFileUrl(value);
    // eslint-disable-next-line @next/next/no-img-element -- kulüp görselleri sharp ile WebP hazırlanır
    return url ? <img src={url} alt="" className={field === "logoKey" ? "size-(--space-16) rounded-control object-cover" : "aspect-8/3 w-full rounded-control object-cover"} /> : null;
  }
  if (Array.isArray(value)) return value.length ? value.map((p) => t(`club.permissions.${p}` as MessageKey)).join(", ") : t("approval.diff.none");
  if (field === "bannedUntil" && typeof value === "string") return formatDate(new Date(`${value}T12:00:00Z`), locale);
  if (field === "membership" || field === "accountStatus") return t(`approval.diff.values.${value}` as MessageKey);
  return String(value);
}

export function diffRows(t: Translate, locale: string, diff: DiffRow[]): DiffViewRow[] {
  return diff.map((row) => ({
    key: row.field,
    label: t(`approval.diff.fields.${row.field}` as MessageKey),
    before: renderValue(t, locale, row.field, row.before),
    after: row.field === "bannedUntil" && row.after === null ? t("approval.diff.permanent") : renderValue(t, locale, row.field, row.after),
  }));
}

export function personName(p: { email: string; profile: { firstName: string; lastName: string } | null } | null | undefined): string {
  if (!p) return "—";
  return [p.profile?.firstName, p.profile?.lastName].filter(Boolean).join(" ") || p.email;
}
