import type { FormFieldType } from "./rules";

/** Hazır form şablonu alanı (EVENTS-FORMS-I18N §4). Saf veri — uygulama katmanı `EventFormField` satırına çevirir. */
export interface TemplateField {
  type: FormFieldType;
  labelTr: string;
  labelEn: string;
  required: boolean;
  teamLevel?: boolean;
  options?: { value: string; labelTr: string; labelEn: string }[];
  config?: { maxLength?: number; min?: number; max?: number; integer?: boolean; accept?: ("pdf" | "jpg" | "png" | "webp")[]; maxMb?: number };
}

export interface FormTemplate {
  key: string;
  labelTr: string;
  labelEn: string;
  fields: TemplateField[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: "sport",
    labelTr: "Spor turnuvası",
    labelEn: "Sports tournament",
    fields: [
      {
        type: "SINGLE_CHOICE",
        labelTr: "Pozisyon",
        labelEn: "Position",
        required: true,
        options: [
          { value: "kaleci", labelTr: "Kaleci", labelEn: "Goalkeeper" },
          { value: "defans", labelTr: "Defans", labelEn: "Defender" },
          { value: "orta-saha", labelTr: "Orta saha", labelEn: "Midfielder" },
          { value: "forvet", labelTr: "Forvet", labelEn: "Forward" },
        ],
      },
      { type: "NUMBER", labelTr: "Forma bedeni", labelEn: "Jersey size", required: true, config: { min: 36, max: 56, integer: true } },
      { type: "LONG_TEXT", labelTr: "Sağlık beyanı", labelEn: "Health declaration", required: true, config: { maxLength: 1000 } },
    ],
  },
  {
    key: "workshop",
    labelTr: "Workshop",
    labelEn: "Workshop",
    fields: [
      {
        type: "SINGLE_CHOICE",
        labelTr: "Deneyim seviyesi",
        labelEn: "Experience level",
        required: true,
        options: [
          { value: "baslangic", labelTr: "Başlangıç", labelEn: "Beginner" },
          { value: "orta", labelTr: "Orta", labelEn: "Intermediate" },
          { value: "ileri", labelTr: "İleri", labelEn: "Advanced" },
        ],
      },
      { type: "LONG_TEXT", labelTr: "Beklentin", labelEn: "What do you expect?", required: false, config: { maxLength: 500 } },
    ],
  },
  {
    key: "trip",
    labelTr: "Gezi",
    labelEn: "Trip",
    fields: [
      { type: "SHORT_TEXT", labelTr: "Acil durum kişisi (ad soyad, telefon)", labelEn: "Emergency contact (name, phone)", required: true, config: { maxLength: 200 } },
      { type: "LONG_TEXT", labelTr: "Diyet / sağlık notu", labelEn: "Diet / health note", required: false, config: { maxLength: 500 } },
    ],
  },
  {
    key: "hackathon",
    labelTr: "Hackathon",
    labelEn: "Hackathon",
    fields: [
      { type: "SHORT_TEXT", labelTr: "GitHub kullanıcı adı", labelEn: "GitHub username", required: false, config: { maxLength: 80 } },
      {
        type: "SINGLE_CHOICE",
        labelTr: "Rol",
        labelEn: "Role",
        required: true,
        options: [
          { value: "frontend", labelTr: "Frontend", labelEn: "Frontend" },
          { value: "backend", labelTr: "Backend", labelEn: "Backend" },
          { value: "tasarim", labelTr: "Tasarım", labelEn: "Design" },
          { value: "diger", labelTr: "Diğer", labelEn: "Other" },
        ],
      },
    ],
  },
];

export function findTemplate(key: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.key === key);
}
