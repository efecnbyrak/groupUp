"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading1, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Underline, Undo2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { EMPTY_DOC, isSafeHref, type RichDoc } from "@/lib/rich-text/doc";

import { cn } from "./cn";
import { controlClass, describedBy, Field } from "./field";

export type RichTextEditorLabels = {
  bold: string;
  italic: string;
  underline: string;
  h1: string;
  h2: string;
  h3: string;
  bulletList: string;
  orderedList: string;
  quote: string;
  link: string;
  linkPrompt: string;
  image: string;
  rule: string;
  undo: string;
  redo: string;
  toolbar: string;
  uploading: string;
};

type Props = {
  id: string;
  label: string;
  labels: RichTextEditorLabels;
  /** Gönderilen form alanı (JSON). */
  name?: string;
  defaultValue?: RichDoc | null;
  onChange?: (doc: RichDoc) => void;
  /** Görseli yükler, `src` döner (null: hata — mesaj `onError` ile). */
  onUploadImage?: (file: File) => Promise<string | null>;
  error?: string;
  hint?: string;
  required?: boolean;
};

const ICON = "size-(--icon-size-sm)";
const ICON_ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Tiptap editörü (EVENTS-FORMS-I18N §3 adım 2): H1–H3, kalın/italik/altı çizili, listeler, alıntı,
 * bağlantı, görsel, yatay çizgi. Yapıştırılan HTML yalnızca bu şemaya ayrıştırılır (diğer her şey
 * atılır); sunucu ayrıca `richDocSchema` ile doğrular.
 */
export function RichTextEditor({ id, label, labels, name, defaultValue, onChange, onUploadImage, error, hint, required }: Props) {
  const [json, setJson] = useState(() => JSON.stringify(defaultValue ?? EMPTY_DOC));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, protocols: ["https", "http", "mailto"], isAllowedUri: (url) => isSafeHref(url) },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: defaultValue ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        ...(describedBy(id, { error, hint }) ? { "aria-describedby": describedBy(id, { error, hint })! } : {}),
        class: "rich-text min-h-(--space-32) px-(--space-3) py-(--space-3) outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as RichDoc;
      setJson(JSON.stringify(doc));
      onChange?.(doc);
    },
  });

  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <div className={cn(controlClass, "flex flex-col p-0 focus-within:outline-(length:--focus-ring-width) focus-within:outline-(--color-focus)")} aria-invalid={error ? true : undefined}>
        {editor ? <Toolbar editor={editor} labels={labels} onUploadImage={onUploadImage} /> : <div className="h-(--control-height-md) border-b border-line" />}
        <EditorContent editor={editor} />
      </div>
      {name ? <input type="hidden" name={name} value={json} /> : null}
    </Field>
  );
}

function Toolbar({ editor, labels, onUploadImage }: { editor: Editor; labels: RichTextEditorLabels; onUploadImage?: (file: File) => Promise<string | null> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "https://";
    const url = window.prompt(labels.linkPrompt, prev);
    if (url === null) return;
    if (url.trim() === "") chain().extendMarkRange("link").unsetLink().run();
    else if (isSafeHref(url.trim())) chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const pickImage = async (file: File | undefined) => {
    if (!file || !onUploadImage) return;
    setUploading(true);
    try {
      const src = await onUploadImage(file);
      if (src) chain().setImage({ src, alt: "" }).run();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div role="toolbar" aria-label={labels.toolbar} className="flex flex-wrap items-center gap-(--space-1) border-b border-line p-(--space-1)">
      <Tool label={labels.h1} active={state.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()} icon={<Heading1 className={ICON} aria-hidden="true" />} />
      <Tool label={labels.h2} active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} icon={<Heading2 className={ICON} aria-hidden="true" />} />
      <Tool label={labels.h3} active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} icon={<Heading3 className={ICON} aria-hidden="true" />} />
      <Sep />
      <Tool label={labels.bold} active={state.bold} onClick={() => chain().toggleBold().run()} icon={<Bold className={ICON} aria-hidden="true" />} />
      <Tool label={labels.italic} active={state.italic} onClick={() => chain().toggleItalic().run()} icon={<Italic className={ICON} aria-hidden="true" />} />
      <Tool label={labels.underline} active={state.underline} onClick={() => chain().toggleUnderline().run()} icon={<Underline className={ICON} aria-hidden="true" />} />
      <Sep />
      <Tool label={labels.bulletList} active={state.bullet} onClick={() => chain().toggleBulletList().run()} icon={<List className={ICON} aria-hidden="true" />} />
      <Tool label={labels.orderedList} active={state.ordered} onClick={() => chain().toggleOrderedList().run()} icon={<ListOrdered className={ICON} aria-hidden="true" />} />
      <Tool label={labels.quote} active={state.quote} onClick={() => chain().toggleBlockquote().run()} icon={<Quote className={ICON} aria-hidden="true" />} />
      <Tool label={labels.link} active={state.link} onClick={setLink} icon={<Link2 className={ICON} aria-hidden="true" />} />
      <Tool label={labels.rule} onClick={() => chain().setHorizontalRule().run()} icon={<Minus className={ICON} aria-hidden="true" />} />
      {onUploadImage ? (
        <>
          <Tool label={uploading ? labels.uploading : labels.image} disabled={uploading} onClick={() => fileRef.current?.click()} icon={<ImagePlus className={ICON} aria-hidden="true" />} />
          <input ref={fileRef} type="file" accept={ICON_ACCEPT} hidden tabIndex={-1} onChange={(e) => void pickImage(e.target.files?.[0])} />
        </>
      ) : null}
      <Sep />
      <Tool label={labels.undo} disabled={!state.canUndo} onClick={() => chain().undo().run()} icon={<Undo2 className={ICON} aria-hidden="true" />} />
      <Tool label={labels.redo} disabled={!state.canRedo} onClick={() => chain().redo().run()} icon={<Redo2 className={ICON} aria-hidden="true" />} />
    </div>
  );
}

function Sep() {
  return <span aria-hidden="true" className="mx-(--space-1) h-(--space-5) w-(--border-width) bg-line" />;
}

function Tool({ label, icon, active, disabled, onClick }: { label: string; icon: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-(--control-height-sm) items-center justify-center rounded-control text-fg-secondary hover:bg-muted hover:text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus) disabled:opacity-40",
        active && "bg-brand-subtle text-fg",
      )}
    >
      {icon}
    </button>
  );
}
