import { FileText, LifeBuoy } from "lucide-react";
import Link from "next/link";

import { personName } from "@/app/_components/requests";
import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { ActionForm, Alert, Avatar, Badge, Card, cn, ConfirmAction, EmptyState, Table, type BadgeTone, type FormField } from "@/components/ui";
import type { MessageKey, Translate } from "@/i18n/messages";
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_FILES } from "@/lib/attachments";
import { formatDateTime } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import { canReopen, closeTicketAction, reopenTicketAction, replyTicketAction, TICKET_CATEGORIES, type getTicketForUser } from "@/modules/ticket";

/** Ticket ekranları (APPROVALS-TICKETS §7) — kulüp paneli, Admin paneli, Platform paneli ortak. */
const tone: Record<string, BadgeTone> = { OPEN: "warning", ANSWERED: "info", CLOSED: "neutral" };

export function TicketStatusBadge({ status, t }: { status: string; t: Translate }) {
  return <Badge tone={tone[status] ?? "neutral"}>{t(`ticket.status.${status}` as MessageKey)}</Badge>;
}

type ListItem = { id: string; subject: string; status: string; category: string; updatedAt: Date; club: { name: string } | null; _count: { messages: number } };

export function TicketTable({ items, basePath, t, locale, showClub }: { items: ListItem[]; basePath: string; t: Translate; locale: string; showClub?: boolean }) {
  return (
    <Table
      caption={t("ticket.title")}
      columns={[
        { key: "subject", header: t("ticket.subject") },
        ...(showClub ? [{ key: "club", header: t("approval.queue.club"), hideBelow: "md" as const }] : []),
        { key: "status", header: t("ticket.statusLabel") },
        { key: "updated", header: t("ticket.updated"), hideBelow: "sm" },
      ]}
      rows={items.map((tk) => ({
        id: tk.id,
        cells: {
          subject: (
            <Link href={`${basePath}/${tk.id}`} className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-link hover:underline">{tk.subject}</span>
              <span className="text-(length:--type-caption) text-fg-secondary">
                {t(`ticket.categories.${tk.category}` as MessageKey)} · {t("ticket.messageCount", { count: tk._count.messages })}
              </span>
            </Link>
          ),
          club: tk.club?.name ?? "—",
          status: <TicketStatusBadge status={tk.status} t={t} />,
          updated: formatDateTime(tk.updatedAt, locale),
        },
      }))}
      empty={<EmptyState icon={<LifeBuoy aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("ticket.empty")} />}
    />
  );
}

export function openTicketFields(t: Translate, hidden: Record<string, string>): FormField[] {
  return [
    ...Object.entries(hidden).map(([name, value]) => ({ type: "hidden" as const, name, value })),
    { type: "select", name: "category", label: t("ticket.category"), required: true, placeholder: t("common.select"), options: TICKET_CATEGORIES.map((c) => ({ value: c, label: t(`ticket.categories.${c}`) })) },
    { type: "text", name: "subject", label: t("ticket.subject"), required: true, maxLength: 160 },
    { type: "textarea", name: "body", label: t("ticket.message"), required: true, rows: 6, maxLength: 5000 },
    { type: "file", name: "files", label: t("approval.attachments"), hint: t("approval.attachmentsHint", { max: ATTACHMENT_MAX_FILES }), accept: ATTACHMENT_ACCEPT, multiple: true },
  ];
}

type Ticket = NonNullable<Awaited<ReturnType<typeof getTicketForUser>>>;

/** Mesaj akışı + yanıt formu + kapat / yeniden aç. Gerçek zamanlı değil; gönderimde yenilenir. */
export function TicketThread({ ticket, t, locale, viewerId, now }: { ticket: Ticket; t: Translate; locale: string; viewerId: string; now: Date }) {
  const closed = ticket.status === "CLOSED";
  return (
    <div className="flex flex-col gap-(--space-6)">
      <div className="flex flex-wrap items-center gap-(--space-2)">
        <TicketStatusBadge status={ticket.status} t={t} />
        <Badge>{t(`ticket.categories.${ticket.category}` as MessageKey)}</Badge>
        {ticket.club ? <Badge tone="brand">{ticket.club.name}</Badge> : null}
      </div>
      <ol className="flex flex-col gap-(--space-4)">
        {ticket.messages.map((m) => {
          const mine = m.authorId === viewerId;
          const name = personName(m.author);
          return (
            <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={cn("flex w-full max-w-(--content-width-sm) flex-col gap-(--space-2) rounded-card border p-(--space-4)", mine ? "border-brand-subtle bg-brand-subtle" : "border-line bg-card")}>
                <div className="flex items-center gap-(--space-2)">
                  <Avatar name={name} src={publicFileUrl(m.author?.profile?.avatarKey)} size="sm" />
                  <span className="min-w-0 truncate text-(length:--type-body-sm) font-semibold text-fg">{name}</span>
                  <span className="ml-auto shrink-0 text-(length:--type-caption) text-fg-secondary">{formatDateTime(m.createdAt, locale)}</span>
                </div>
                <p className="text-(length:--type-body-sm) break-words whitespace-pre-line text-fg">{m.body}</p>
                {m.attachments.length ? (
                  <ul className="flex flex-col gap-(--space-1)">
                    {m.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-(--space-1) text-(length:--type-caption) font-semibold text-link hover:underline">
                          <FileText aria-hidden="true" className="size-(--icon-size-sm)" />
                          <span className="break-all">{a.fileName}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {closed ? (
        <Alert tone="info">
          {canReopen(ticket.status, ticket.closedAt, now) ? t("ticket.closedReopenable") : t("ticket.closedFinal")}
        </Alert>
      ) : (
        <Card className="flex flex-col gap-(--space-3)">
          <h2 className="text-(length:--type-body) font-semibold text-fg">{t("ticket.reply")}</h2>
          <ActionForm
            action={replyTicketAction}
            resetOnSuccess
            fields={[
              { type: "hidden", name: "ticketId", value: ticket.id },
              { type: "textarea", name: "body", label: t("ticket.message"), required: true, rows: 4, maxLength: 5000 },
              { type: "file", name: "files", label: t("approval.attachments"), hint: t("approval.attachmentsHint", { max: ATTACHMENT_MAX_FILES }), accept: ATTACHMENT_ACCEPT, multiple: true },
            ]}
            submitLabel={t("ticket.send")}
            {...formLabels(t)}
          />
        </Card>
      )}
      <div className="flex flex-wrap gap-(--space-2)">
        {closed ? (
          canReopen(ticket.status, ticket.closedAt, now) ? (
            <ConfirmAction action={reopenTicketAction} values={{ ticketId: ticket.id }} variant="primary" triggerLabel={t("ticket.reopen")} title={t("ticket.reopen")} {...confirmLabels(t)} />
          ) : null
        ) : (
          <ConfirmAction action={closeTicketAction} values={{ ticketId: ticket.id }} triggerLabel={t("ticket.close")} title={t("ticket.closeTitle")} description={t("ticket.closeBody")} {...confirmLabels(t)} />
        )}
      </div>
    </div>
  );
}
