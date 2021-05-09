import * as React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import Cookies from "universal-cookie";
import { LoginServicePromiseClient } from "../proto/login_service_grpc_web_pb";
import { Banner } from "./banner";
import { Login } from "./login";
import { Logout } from "./logout";
import { ProtectedRoute, ProtectedRouteProps } from "./protected_route";
import { User, UserModel } from "./user_model";
import { UserStorage } from "./user_storage";
import { WishList } from "./wishlist";

interface Props {}

interface State {
  user: User | null;
}

class App extends React.Component<Props, State> {
  private readonly userModel: UserModel;
  private readonly cookies: Cookies;

  constructor(props: Props) {
    super(props);

    const userService = new LoginServicePromiseClient(
      "http://nash.simmonmt.org:8081",
      null,
      null
    );
    const userStorage = new UserStorage();
    this.cookies = new Cookies();

    this.userModel = new UserModel(userService, userStorage, this.cookies);
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
            <ProtectedRoute {...defaultProtectedRouteProps} path="/view">
              <WishList />
            </ProtectedRoute>
            <ProtectedRoute {...defaultProtectedRouteProps} path="/">
              <Home />
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

function Home() {
  return <h2>Home</h2>;
}

export { App };
