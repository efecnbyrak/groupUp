"use client";

import { useState } from "react";

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
import { FormMessage, SubmitButton, TextField, useFormAction } from "./form-parts";
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
        <TextField
          id="code"
          label={labels["auth.fields.code"]}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          required
          error={verify.fieldError("code")}
          className="h-(--control-height-lg) w-full rounded-field border border-line-input bg-card px-(--space-3) text-center font-mono text-(length:--type-heading-md) tracking-[0.4em] text-fg"
        />
        <SubmitButton pending={verify.pending} label={labels["auth.verify.submit"]} pendingLabel={labels["common.loading"]} />
      </form>
      <form onSubmit={resend.onSubmit}>
        <button
          type="submit"
          disabled={resend.pending}
          className="text-(length:--type-body-sm) text-(--color-link) underline disabled:opacity-60"
        >
          {labels["auth.verify.resend"]}
        </button>
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
      <TextField id="email" type="email" label={labels["auth.fields.emailPlain"]} autoComplete="email" required />
      <PasswordInput id="password" autoComplete="current-password" labels={passwordLabels(labels, labels["auth.fields.password"], false)} />
      <SubmitButton pending={form.pending} label={labels["auth.login.submit"]} pendingLabel={labels["common.loading"]} />
    </form>
  );
}

export function ForgotPasswordForm({ labels }: { labels: Labels<typeof FORGOT_KEYS> }) {
  const form = useFormAction(forgotPasswordAction);
  return (
    <form onSubmit={form.onSubmit} className={formClass} noValidate>
      <FormMessage state={form.state} />
      <TextField id="email" type="email" label={labels["auth.fields.emailPlain"]} autoComplete="email" required error={form.fieldError("email")} />
      <SubmitButton pending={form.pending} label={labels["auth.forgot.submit"]} pendingLabel={labels["common.loading"]} />
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
      <SubmitButton pending={form.pending} label={labels["auth.reset.submit"]} pendingLabel={labels["common.loading"]} />
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
      <SubmitButton pending={form.pending} label={labels["auth.security.changePasswordSubmit"]} pendingLabel={labels["common.loading"]} />
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
        <TextField
          id="change-code"
          name="code"
          label={labels["auth.fields.code"]}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          error={confirm.fieldError("code")}
        />
        <SubmitButton pending={confirm.pending} label={labels["auth.security.confirmEmail"]} pendingLabel={labels["common.loading"]} />
        <button type="button" onClick={() => setCancelled(request.state)} className="text-(length:--type-body-sm) text-(--color-link) underline">
          {labels["auth.security.newEmail"]}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={request.onSubmit} className={formClass} noValidate>
      <FormMessage state={request.state?.ok ? null : request.state} />
      <TextField
        id="new-email"
        name="email"
        type="email"
        autoComplete="email"
        label={labels["auth.security.newEmail"]}
        hint={labels["auth.security.changeEmailHint"]}
        required
        error={request.fieldError("email")}
      />
      <SubmitButton pending={request.pending} label={labels["auth.security.sendCode"]} pendingLabel={labels["common.loading"]} />
    </form>
  );
}
