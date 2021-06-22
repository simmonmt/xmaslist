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
      if (this.props.location && this.props.location.pathname !== "/") {
        const params = new URLSearchParams();
        params.append("redirect", this.props.location.pathname);
        search = "?" + params.toString();
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
