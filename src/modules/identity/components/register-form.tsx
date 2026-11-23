"use client";

import { useState } from "react";

import { Button, Checkbox, FormMessage, Input, Select, useFormAction } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

import { checkEmailAction, registerAction, type CheckEmailData } from "../actions";
import type { Labels, REGISTER_KEYS } from "./labels";
import { passwordLabels, PasswordInput } from "./password-input";

type L = Labels<typeof REGISTER_KEYS>;
type UniversityRequestAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/**
 * Kayıt — AUTH-EMAIL §1. Adım 1: mail → domain çözümleme. Bulunursa adım 2 (profil formu),
 * bulunamazsa üniversite talebi formu.
 */
export function RegisterForm({ labels, requestUniversity }: { labels: L; requestUniversity: UniversityRequestAction }) {
  const check = useFormAction(checkEmailAction);
  // "E-postayı değiştir" mevcut sonucu kapatır; yeni gönderim yeni sonuç nesnesi üretir.
  const [dismissed, setDismissed] = useState<CheckEmailData | undefined>(undefined);
  const result = check.state?.ok ? check.state.data : undefined;

  if (result && result !== dismissed) {
    const back = (
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setDismissed(result)}>
        {labels["auth.register.changeEmail"]}
      </Button>
    );
    if (result.status === "notFound") {
      return <UniversityRequest email={result.email} labels={labels} action={requestUniversity} back={back} />;
    }
    return <ProfileStep data={result} labels={labels} back={back} />;
  }

  return (
    <form onSubmit={check.onSubmit} className="flex flex-col gap-(--space-4)" noValidate>
      <FormMessage state={check.state && !check.state.ok ? check.state : null} />
      <Input
        id="email"
        type="email"
        label={labels["auth.fields.email"]}
        autoComplete="email"
        required
        error={check.fieldError("email")}
      />
      <Button type="submit" size="lg" block loading={check.pending} loadingLabel={labels["common.loading"]}>
        {labels["auth.register.continue"]}
      </Button>
    </form>
  );
}

type FoundData = Extract<CheckEmailData, { status: "found" }>;

function ProfileStep({ data, labels, back }: { data: FoundData; labels: L; back: React.ReactNode }) {
  const form = useFormAction(registerAction);
  const [facultyId, setFacultyId] = useState("");
  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const departments = data.faculties.find((f) => f.id === facultyId)?.departments ?? [];
  const localPart = data.email.split("@")[0] ?? "";
  const isAlumni = data.type === "ALUMNI";
  const err = form.fieldError;

  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-(--space-4)" noValidate>
      <div className="flex flex-col gap-(--space-1) rounded-control bg-muted p-(--space-3) text-(length:--type-body-sm)">
        <p className="font-semibold text-fg">{data.email}</p>
        <p className="text-fg-secondary">
          {data.universityName} — {isAlumni ? labels["auth.register.typeAlumni"] : labels["auth.register.typeStudent"]}
        </p>
        {back}
      </div>
      <FormMessage state={form.state} />
      <input type="hidden" name="email" value={data.email} />

      <div className="grid gap-(--space-4) sm:grid-cols-2">
        <Input
          id="firstName"
          label={labels["auth.fields.firstName"]}
          autoComplete="given-name"
          required
          error={err("firstName")}
          onChange={(e) => setNames((n) => ({ ...n, firstName: e.target.value }))}
        />
        <Input
          id="lastName"
          label={labels["auth.fields.lastName"]}
          autoComplete="family-name"
          required
          error={err("lastName")}
          onChange={(e) => setNames((n) => ({ ...n, lastName: e.target.value }))}
        />
      </div>

      <Input
        id="studentNo"
        label={labels["auth.fields.studentNo"]}
        defaultValue={/^\d+$/.test(localPart) ? localPart : ""}
        inputMode="text"
        required
        error={err("studentNo")}
      />

      <Select
        id="facultyId"
        label={labels["auth.fields.faculty"]}
        placeholder={labels["common.select"]}
        options={data.faculties.map((f) => ({ value: f.id, label: f.nameTr }))}
        value={facultyId}
        onChange={(e) => setFacultyId(e.target.value)}
        required
        error={err("facultyId")}
      />
      <Select
        key={facultyId}
        id="departmentId"
        label={labels["auth.fields.department"]}
        placeholder={labels["common.select"]}
        options={departments.map((d) => ({ value: d.id, label: d.nameTr }))}
        disabled={!facultyId}
        required
        error={err("departmentId")}
      />

      {isAlumni ? (
        <Input
          id="graduationYear"
          type="number"
          inputMode="numeric"
          min={1950}
          max={new Date().getFullYear() + 1}
          label={labels["auth.fields.graduationYear"]}
          required
          error={err("graduationYear")}
        />
      ) : (
        <Select
          id="classYear"
          label={labels["auth.fields.classYear"]}
          placeholder={labels["common.select"]}
          options={(["0", "1", "2", "3", "4", "5", "6"] as const).map((y) => ({ value: y, label: labels[`auth.classYears.${y}`] }))}
          required
          error={err("classYear")}
        />
      )}

      <div className="grid gap-(--space-4) sm:grid-cols-2">
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+905551234567"
          label={labels["auth.fields.phone"]}
          required
          error={err("phone")}
        />
        <Input id="birthDate" type="date" label={labels["auth.fields.birthDate"]} autoComplete="bday" required error={err("birthDate")} />
      </div>

      <Select
        id="gender"
        label={labels["auth.fields.gender"]}
        placeholder={labels["common.select"]}
        options={(["FEMALE", "MALE", "OTHER", "PREFER_NOT_TO_SAY"] as const).map((g) => ({ value: g, label: labels[`auth.genders.${g}`] }))}
        required
        error={err("gender")}
      />

      <PasswordInput
        id="password"
        autoComplete="new-password"
        labels={passwordLabels(labels, labels["auth.fields.password"], true)}
        context={{ email: data.email, ...names }}
        error={err("password")}
      />
      <PasswordInput
        id="passwordConfirm"
        autoComplete="new-password"
        labels={passwordLabels(labels, labels["auth.fields.passwordConfirm"], false)}
        error={err("passwordConfirm")}
      />

      <Checkbox id="kvkk" required label={labels["auth.fields.kvkk"]} error={err("kvkk")} />

      <Button type="submit" size="lg" block loading={form.pending} loadingLabel={labels["common.loading"]}>
        {labels["auth.register.submit"]}
      </Button>
    </form>
  );
}

function UniversityRequest({
  email,
  labels,
  action,
  back,
}: {
  email: string;
  labels: L;
  action: UniversityRequestAction;
  back: React.ReactNode;
}) {
  const form = useFormAction(action);
  if (form.state?.ok) return <FormMessage state={form.state} />;
  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-(--space-4)" noValidate>
      <div className="flex flex-col gap-(--space-1)">
        <h2 className="font-semibold text-fg">{labels["auth.register.notFoundTitle"]}</h2>
        <p className="text-(length:--type-body-sm) text-fg-secondary">{labels["auth.register.notFoundBody"]}</p>
        {back}
      </div>
      <FormMessage state={form.state} />
      <Input id="uni-email" name="email" type="email" label={labels["auth.fields.emailPlain"]} defaultValue={email} readOnly />
      <Input id="uni-name" name="name" label={labels["auth.fields.universityName"]} required error={form.fieldError("name")} />
      <Input id="uni-note" name="note" label={labels["auth.fields.note"]} error={form.fieldError("note")} />
      <Button type="submit" size="lg" block loading={form.pending} loadingLabel={labels["common.loading"]}>
        {labels["auth.register.requestSubmit"]}
      </Button>
    </form>
  );
}
