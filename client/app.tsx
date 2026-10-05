import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { createTheme, styled, ThemeProvider } from "@mui/material/styles";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import * as React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router";
import Cookies from "universal-cookie";
import { AuthModel } from "./auth_model";
import { AuthStorage } from "./auth_storage";
import { Banner } from "./banner";
import { AuthService } from "./gen/proto/auth_service_pb";
import { ListService } from "./gen/proto/list_service_pb";
import { UserService } from "./gen/proto/user_service_pb";
import { ItemList } from "./item_list";
import { ListList } from "./list_list";
import { ListModel } from "./list_model";
import { Login } from "./login";
import { Logout } from "./logout";
import { RequireAuth } from "./require_auth";
import { User } from "./user";
import { UserModel } from "./user_model";

// Keep the look of the app as it was under Material UI v4, whose defaults
// differ from those of later versions.
const theme = createTheme({
  palette: {
    // The v4 default palette: indigo, pink, red.
    primary: { light: "#7986cb", main: "#3f51b5", dark: "#303f9f" },
    secondary: { light: "#ff4081", main: "#f50057", dark: "#c51162" },
    error: { light: "#e57373", main: "#f44336", dark: "#d32f2f" },
    text: { secondary: "rgba(0, 0, 0, 0.54)" },
  },
  components: {
    // No divider above the item that follows an expanded accordion.
    MuiAccordion: {
      styleOverrides: {
        root: {
          "&.Mui-expanded + .MuiAccordion-root::before": { display: "none" },
        },
      },
    },
    // v4 dialog content padding, including when it follows a title.
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "8px 24px",
          ".MuiDialogTitle-root + &": { paddingTop: 8 },
        },
      },
    },
    MuiLink: { defaultProps: { underline: "hover" } },
    MuiSwitch: { defaultProps: { color: "secondary" } },
    MuiTextField: { defaultProps: { variant: "standard" } },
  },
});

const Root = styled("div")({
  height: "100%",
  display: "flex",
  flexDirection: "column",
});

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

    const transport = createConnectTransport({ baseUrl: rpcUrl });

    const authService = createClient(AuthService, transport);
    const authStorage = new AuthStorage();
    this.cookies = new Cookies();

    const listService = createClient(ListService, transport);
    const userService = createClient(UserService, transport);

    this.authModel = new AuthModel(authService, authStorage, this.cookies);
    this.listModel = new ListModel(listService, this.authModel);
    this.userModel = new UserModel(userService, this.authModel);
    this.state = {
      user: this.authModel.getUser(),
    };
  }

  render() {
    const isLoggedIn = this.state.user !== null;
    const authPath = "/login";

    // As under react-router v5: the router updates the UI in the same render
    // as the URL (useTransitions={false}) rather than in a transition, and
    // routes match their paths as prefixes (the trailing /*).
    return (
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Router useTransitions={false}>
            <Root>
              <Banner user={this.state.user} />

              <Routes>
                <Route
                  path="/login/*"
                  element={
                    <Login
                      user={this.state.user}
                      authModel={this.authModel}
                      onLogin={(user: User) => this.handleLogin(user)}
                    />
                  }
                />
                <Route
                  path="/logout/*"
                  element={
                    <Logout
                      authModel={this.authModel}
                      onLogout={() => this.handleLogout()}
                    />
                  }
                />
                <Route
                  path="/view/:listId/*"
                  element={
                    <RequireAuth isLoggedIn={isLoggedIn} authPath={authPath}>
                      <ItemList
                        listModel={this.listModel}
                        userModel={this.userModel}
                        currentUser={this.state.user!}
                        mode="view"
                      />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/edit/:listId/*"
                  element={
                    <RequireAuth isLoggedIn={isLoggedIn} authPath={authPath}>
                      <ItemList
                        listModel={this.listModel}
                        userModel={this.userModel}
                        currentUser={this.state.user!}
                        mode="edit"
                      />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/"
                  element={
                    <RequireAuth isLoggedIn={isLoggedIn} authPath={authPath}>
                      <ListList
                        listModel={this.listModel}
                        userModel={this.userModel}
                        currentUser={this.state.user!}
                      />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Root>
          </Router>
        </LocalizationProvider>
      </ThemeProvider>
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
