import * as React from "react";
import { Navigate, useLocation } from "react-router";

export interface RequireAuthProps {
  isLoggedIn: boolean;
  authPath: string;
  children: React.ReactNode;
}

// Renders its children if the user is logged in. Otherwise sends the user to
// the login page, which will come back here after logging in.
export function RequireAuth(props: RequireAuthProps) {
  const location = useLocation();

  if (!props.isLoggedIn) {
    let search = "";
    if (location.pathname !== "/") {
      const params = new URLSearchParams();
      params.append(
        "redirect",
        location.pathname + location.search + location.hash
      );
      search = "?" + params.toString();
    }

    return (
      <Navigate to={{ pathname: props.authPath, search: search }} replace />
    );
  }

  return <>{props.children}</>;
}
