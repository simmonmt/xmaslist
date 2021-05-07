import * as React from "react";
import { BrowserRouter as Router, Link, Route, Switch } from "react-router-dom";
import Cookies from "universal-cookie";
import { UserServicePromiseClient } from "../proto/user_service_grpc_web_pb";
import { Login } from "./login";
import { Logout } from "./logout";
import { UserModel } from "./user_model";
import { UserStorage } from "./user_storage";
import { WishList } from "./wishlist";

interface Props {}

interface State {}

class App extends React.Component<Props, State> {
  private readonly userModel: UserModel;
  private readonly cookies: Cookies;

  constructor(props: Props) {
    super(props);

    const userService = new UserServicePromiseClient(
      "http://nash.simmonmt.org:8081",
      null,
      null
    );
    const userStorage = new UserStorage();
    this.cookies = new Cookies();

    this.userModel = new UserModel(userService, userStorage, this.cookies);
  }

  render() {
    return (
      <Router>
        <div>
          <nav>
            <ul>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/view">View</Link>
              </li>
              <li>
                <Link to="/login">Login</Link>
              </li>
              <li>
                <Link to="/logout">Logout</Link>
              </li>
            </ul>
          </nav>

          <Switch>
            <Route path="/view">
              <WishList />
            </Route>
            <Route path="/login">
              <Login userModel={this.userModel} />
            </Route>
            <Route path="/logout">
              <Logout userModel={this.userModel} />
            </Route>
            <Route path="/">
              <Home />
            </Route>
          </Switch>
        </div>
      </Router>
    );
  }
}

function Home() {
  return <h2>Home</h2>;
}

export { App };
