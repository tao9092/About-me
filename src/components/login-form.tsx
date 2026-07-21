"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="auth-form">
      <label>
        Email <em aria-label="required">*</em>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password <em aria-label="required">*</em>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      {state?.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
