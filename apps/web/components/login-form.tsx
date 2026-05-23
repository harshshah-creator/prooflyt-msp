"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../app/login/actions";

const initialState: LoginState = {};

/**
 *  Login form. The default password (used to pre-fill the input on the
 *  demo deployment) is passed in by the server-rendered LoginPage from
 *  `process.env.DEMO_PASSWORD`. We never read env vars in this Client
 *  Component because doing so would force `NEXT_PUBLIC_*` exposure of
 *  the password into the client bundle.
 */
export function LoginForm({ defaultPassword = "" }: { defaultPassword?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form className="public-form" action={formAction}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" defaultValue="arjun@bombaygrooming.com" />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" defaultValue={defaultPassword} />
      </label>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
