"use client";

import { useState } from "react";

import { Button, FormMessage, Input, OtpInput, useFormAction } from "@/components/ui";

import {
  confirmEmailChangeAction,
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  requestEmailChangeAction,
  resendOtpAction,
  resetPasswordAction,
  verifyEmailAction,
} from "../actions";
import type { FORGOT_KEYS, Labels, LOGIN_KEYS, RESET_KEYS, SECURITY_KEYS, VERIFY_KEYS } from "./labels";
import { passwordLabels, PasswordInput } from "./password-input";

const formClass = "flex flex-col gap-(--space-4)";

export function OtpForm({ labels, initialError }: { labels: Labels<typeof VERIFY_KEYS>; initialError?: string }) {
  const verify = useFormAction(verifyEmailAction);
  const resend = useFormAction(resendOtpAction);
  const initial = initialError ? { ok: false as const, error: initialError } : null;
  const message = verify.state && !verify.state.ok ? verify.state : (resend.state ?? initial);
  return (
    <div className="flex flex-col gap-(--space-4)">
      <FormMessage state={message} />
      <form onSubmit={verify.onSubmit} className={formClass} noValidate>
        <OtpInput id="code" label={labels["auth.fields.code"]} error={verify.fieldError("code")} autoFocus />
        <Button type="submit" size="lg" block loading={verify.pending} loadingLabel={labels["common.loading"]}>
          {labels["auth.verify.submit"]}
        </Button>
      </form>
      <form onSubmit={resend.onSubmit}>
        <Button type="submit" variant="ghost" size="sm" loading={resend.pending}>
          {labels["auth.verify.resend"]}
        </Button>
      </form>
    </div>
  );
}

export function LoginForm({ labels, next }: { labels: Labels<typeof LOGIN_KEYS>; next?: string }) {
  const form = useFormAction(loginAction);
  return (
    <form onSubmit={form.onSubmit} className={formClass} noValidate>
      <FormMessage state={form.state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Input id="email" type="email" label={labels["auth.fields.emailPlain"]} autoComplete="email" required />
      <PasswordInput id="password" autoComplete="current-password" labels={passwordLabels(labels, labels["auth.fields.password"], false)} />
      <Button type="submit" size="lg" block loading={form.pending} loadingLabel={labels["common.loading"]}>
          {labels["auth.login.submit"]}
        </Button>
    </form>
  );
}

export function ForgotPasswordForm({ labels }: { labels: Labels<typeof FORGOT_KEYS> }) {
  const form = useFormAction(forgotPasswordAction);
  return (
    <form onSubmit={form.onSubmit} className={formClass} noValidate>
      <FormMessage state={form.state} />
      <Input id="email" type="email" label={labels["auth.fields.emailPlain"]} autoComplete="email" required error={form.fieldError("email")} />
      <Button type="submit" size="lg" block loading={form.pending} loadingLabel={labels["common.loading"]}>
          {labels["auth.forgot.submit"]}
        </Button>
    </form>
  );
}

export function ResetPasswordForm({ labels, token }: { labels: Labels<typeof RESET_KEYS>; token: string }) {
  const form = useFormAction(resetPasswordAction);
  return (
    <form onSubmit={form.onSubmit} className={formClass} noValidate>
      <FormMessage state={form.state} />
      <input type="hidden" name="token" value={token} />
      <PasswordInput
        id="password"
        autoComplete="new-password"
        labels={passwordLabels(labels, labels["auth.fields.newPassword"], true)}
        error={form.fieldError("password")}
      />
      <PasswordInput
        id="passwordConfirm"
        autoComplete="new-password"
        labels={passwordLabels(labels, labels["auth.fields.passwordConfirm"], false)}
        error={form.fieldError("passwordConfirm")}
      />
      <Button type="submit" size="lg" block loading={form.pending} loadingLabel={labels["common.loading"]}>
          {labels["auth.reset.submit"]}
        </Button>
    </form>
  );
}

export function ChangePasswordForm({ labels }: { labels: Labels<typeof SECURITY_KEYS> }) {
  const form = useFormAction(changePasswordAction);
  return (
    <form key={form.state?.ok ? "done" : "edit"} onSubmit={form.onSubmit} className={formClass} noValidate>
      <FormMessage state={form.state} />
      <PasswordInput
        id="currentPassword"
        autoComplete="current-password"
        labels={passwordLabels(labels, labels["auth.fields.currentPassword"], false)}
        error={form.fieldError("currentPassword")}
      />
      <PasswordInput
        id="password"
        autoComplete="new-password"
        labels={passwordLabels(labels, labels["auth.fields.newPassword"], true)}
        error={form.fieldError("password")}
      />
      <PasswordInput
        id="passwordConfirm"
        autoComplete="new-password"
        labels={passwordLabels(labels, labels["auth.fields.passwordConfirm"], false)}
        error={form.fieldError("passwordConfirm")}
      />
      <Button type="submit" size="lg" block loading={form.pending} loadingLabel={labels["common.loading"]}>
          {labels["auth.security.changePasswordSubmit"]}
        </Button>
    </form>
  );
}

export function ChangeEmailForm({ labels }: { labels: Labels<typeof SECURITY_KEYS> }) {
  const request = useFormAction(requestEmailChangeAction);
  const confirm = useFormAction(confirmEmailChangeAction);
  const [cancelled, setCancelled] = useState<unknown>(null);
  const pendingEmail = request.state?.ok && request.state !== cancelled ? request.state.data?.email : undefined;

  if (confirm.state?.ok) return <FormMessage state={confirm.state} />;

  if (pendingEmail) {
    return (
      <form onSubmit={confirm.onSubmit} className={formClass} noValidate>
        <FormMessage state={confirm.state ?? request.state} />
        <input type="hidden" name="email" value={pendingEmail} />
        <OtpInput id="change-code" name="code" label={labels["auth.fields.code"]} error={confirm.fieldError("code")} />
        <Button type="submit" size="lg" block loading={confirm.pending} loadingLabel={labels["common.loading"]}>
          {labels["auth.security.confirmEmail"]}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCancelled(request.state)}>
          {labels["auth.security.newEmail"]}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={request.onSubmit} className={formClass} noValidate>
      <FormMessage state={request.state?.ok ? null : request.state} />
      <Input
        id="new-email"
        name="email"
        type="email"
        autoComplete="email"
        label={labels["auth.security.newEmail"]}
        hint={labels["auth.security.changeEmailHint"]}
        required
        error={request.fieldError("email")}
      />
      <Button type="submit" size="lg" block loading={request.pending} loadingLabel={labels["common.loading"]}>
          {labels["auth.security.sendCode"]}
        </Button>
    </form>
  );
}
