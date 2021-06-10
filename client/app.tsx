import DateFnsUtils from "@date-io/date-fns";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import * as React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import Cookies from "universal-cookie";
import { AuthServicePromiseClient } from "../proto/auth_service_grpc_web_pb";
import { ListServicePromiseClient } from "../proto/list_service_grpc_web_pb";
import { UserServicePromiseClient } from "../proto/user_service_grpc_web_pb";
import { AuthModel } from "./auth_model";
import { AuthStorage } from "./auth_storage";
import { Banner } from "./banner";
import { Home } from "./home";
import { ListModel } from "./list_model";
import { Login } from "./login";
import { Logout } from "./logout";
import { ProtectedRoute, ProtectedRouteProps } from "./protected_route";
import { User } from "./user";
import { UserModel } from "./user_model";

interface Props {}

interface State {
  user: User | null;
}

class App extends React.Component<Props, State> {
  private readonly authModel: AuthModel;
  private readonly listModel: ListModel;
  private readonly userModel: UserModel;
  private readonly cookies: Cookies;

  constructor(props: Props) {
    super(props);

    const rpcUrl = document.location.origin;
    console.log("rpcUrl", rpcUrl);

    const authService = new AuthServicePromiseClient(rpcUrl, null, null);
    const authStorage = new AuthStorage();
    this.cookies = new Cookies();

    const listService = new ListServicePromiseClient(rpcUrl, null, null);
    const userService = new UserServicePromiseClient(rpcUrl, null, null);

    this.authModel = new AuthModel(authService, authStorage, this.cookies);
    this.listModel = new ListModel(listService, this.authModel);
    this.userModel = new UserModel(userService, this.authModel);
    this.state = {
      user: this.authModel.getUser(),
    };
  }

  render() {
    const defaultProtectedRouteProps: ProtectedRouteProps = {
      isLoggedIn: this.state.user !== null,
      authPath: "/login",
    };

    return (
      <MuiPickersUtilsProvider utils={DateFnsUtils}>
        <Router>
          <div>
            <Banner user={this.state.user} />

            <Switch>
              <Route path="/login">
                <Login
                  user={this.state.user}
                  authModel={this.authModel}
                  onLogin={(user: User) => this.handleLogin(user)}
                />
              </Route>
              <Route path="/logout">
                <Logout
                  authModel={this.authModel}
                  onLogout={() => this.handleLogout()}
                />
              </Route>
              <ProtectedRoute {...defaultProtectedRouteProps} path="/">
                <Home
                  listModel={this.listModel}
                  userModel={this.userModel}
                  currentUser={this.state.user!}
                />
              </ProtectedRoute>
            </Switch>
          </div>
        </Router>
      </MuiPickersUtilsProvider>
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
