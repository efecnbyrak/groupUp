import { Badge, type BadgeTone, type DiffViewRow } from "@/components/ui";
import type { MessageKey, Translate } from "@/i18n/messages";
import { formatDate, formatDateTime } from "@/lib/dates";
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
const DATE_FIELDS = new Set(["startAt", "endAt", "applyOpensAt", "applyClosesAt"]);
const ENUM_FIELDS: Record<string, string> = { mode: "event.mode", eligibility: "event.eligibility" };

function renderValue(t: Translate, locale: string, field: string, value: DiffValue): React.ReactNode {
  if (value === null) return <span className="text-fg-secondary">{t("approval.diff.empty")}</span>;
  if (IMAGE_FIELDS.has(field) && typeof value === "string") {
    const url = publicFileUrl(value);
    // eslint-disable-next-line @next/next/no-img-element -- kulüp görselleri sharp ile WebP hazırlanır
    return url ? <img src={url} alt="" className={field === "logoKey" ? "size-(--space-16) rounded-control object-cover" : "aspect-8/3 w-full rounded-control object-cover"} /> : null;
  }
  if (field === "images" && Array.isArray(value)) {
    return value.length ? (
      <span className="flex flex-wrap gap-(--space-1)">
        {value.map((k) => (
          // eslint-disable-next-line @next/next/no-img-element -- sharp ile WebP
          <img key={k} src={publicFileUrl(k) ?? ""} alt="" className="size-(--space-12) rounded-control object-cover" />
        ))}
      </span>
    ) : (
      t("approval.diff.empty")
    );
  }
  if (DATE_FIELDS.has(field) && typeof value === "string") return formatDateTime(new Date(value), locale);
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (field in ENUM_FIELDS && typeof value === "string") return t(`${ENUM_FIELDS[field]}.${value}` as MessageKey);
  if (field === "descriptionTr" && typeof value === "string") return <span className="line-clamp-6 whitespace-pre-line">{value}</span>;
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
