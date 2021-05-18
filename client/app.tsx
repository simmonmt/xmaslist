import * as React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import Cookies from "universal-cookie";
import { ListServicePromiseClient } from "../proto/list_service_grpc_web_pb";
import { LoginServicePromiseClient } from "../proto/login_service_grpc_web_pb";
import { Banner } from "./banner";
import { Home } from "./home";
import { ListModel } from "./list_model";
import { Login } from "./login";
import { Logout } from "./logout";
import { ProtectedRoute, ProtectedRouteProps } from "./protected_route";
import { User, UserModel } from "./user_model";
import { UserStorage } from "./user_storage";

interface Props {}

interface State {
  user: User | null;
}

class App extends React.Component<Props, State> {
  private readonly listModel: ListModel;
  private readonly userModel: UserModel;
  private readonly cookies: Cookies;

  constructor(props: Props) {
    super(props);

    const rpcUrl = document.location.origin;
    console.log("rpcUrl", rpcUrl);

    const userService = new LoginServicePromiseClient(rpcUrl, null, null);
    const userStorage = new UserStorage();
    this.cookies = new Cookies();

    const listService = new ListServicePromiseClient(rpcUrl, null, null);

    this.userModel = new UserModel(userService, userStorage, this.cookies);
    this.listModel = new ListModel(listService, this.userModel);
    this.state = {
      user: this.userModel.getUser(),
    };
  }

  render() {
    const defaultProtectedRouteProps: ProtectedRouteProps = {
      isLoggedIn: this.state.user !== null,
      authPath: "/login",
    };

    return (
      <Router>
        <div>
          <Banner user={this.state.user} />

          <Switch>
            <Route path="/login">
              <Login
                user={this.state.user}
                userModel={this.userModel}
                onLogin={(user: User) => this.handleLogin(user)}
              />
            </Route>
            <Route path="/logout">
              <Logout
                userModel={this.userModel}
                onLogout={() => this.handleLogout()}
              />
            </Route>
            <ProtectedRoute {...defaultProtectedRouteProps} path="/">
              <Home listModel={this.listModel} />
            </ProtectedRoute>
          </Switch>
        </div>
      </Router>
    );
  }

  private handleLogin(user: User) {
    this.setState({ user: user });
  }

  private handleLogout() {
    this.setState({ user: null });
  }
}

export { App };
