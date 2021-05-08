import * as React from "react";
import { Redirect, Route, RouteProps } from "react-router";

export interface ProtectedRouteProps extends RouteProps {
  isLoggedIn: boolean;
  authPath: string;
}

export class ProtectedRoute extends Route<ProtectedRouteProps> {
  public render() {
    if (!this.props.isLoggedIn) {
      let search = "";
      if (this.props.path !== undefined) {
        let redirectPath: string;
        if (typeof this.props.path === "string") {
          redirectPath = this.props.path;
        } else {
          redirectPath = this.props.path[0];
        }

        if (redirectPath !== "/") {
          const params = new URLSearchParams();
          params.append("redirect", redirectPath);
          search = "?" + params.toString();
        }
      }

      return (
        <Route path={this.props.path}>
          <Redirect to={{ pathname: this.props.authPath, search: search }} />
        </Route>
      );
    }

    return <Route {...this.props} />;
  }
}
