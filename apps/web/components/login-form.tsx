"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../app/login/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form className="public-form" action={formAction}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" defaultValue="arjun@bombaygrooming.com" />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" defaultValue="ProoflytDemo!2026" />
      </label>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
