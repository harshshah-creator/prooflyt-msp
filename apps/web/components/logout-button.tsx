"use client";

import { logoutAction } from "../app/login/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="ghost-button">
        Log out
      </button>
    </form>
  );
}
