import { create } from "@bufbuild/protobuf";
import { Client } from "@connectrpc/connect";
import Cookies from "universal-cookie";
import { AuthStorage } from "./auth_storage";
import {
  AuthService,
  LoginRequestSchema,
  LoginResponse,
  LogoutRequestSchema,
  LogoutResponse,
} from "./gen/proto/auth_service_pb";
import { User } from "./user";

const COOKIE_NAME = "session";
// Set and remove the cookie with an explicit path. Otherwise the browser
// derives one from the URL the page was loaded from (e.g. /view after a deep
// link), and the cookie is then missing elsewhere.
const COOKIE_PATH = "/";

export class AuthModel {
  private readonly authService: Client<typeof AuthService>;
  private readonly authStorage: AuthStorage;
  private readonly cookies: Cookies;
  // The logout in progress, if any.
  private pendingLogout: Promise<boolean> | null = null;

  constructor(
    authService: Client<typeof AuthService>,
    authStorage: AuthStorage,
    cookies: Cookies
  ) {
    this.authService = authService;
    this.authStorage = authStorage;
    this.cookies = cookies;

    const cookie = this.cookies.get(COOKIE_NAME);
    console.log("auth model ctor: got cookie", cookie);
    const userInfo = this.authStorage.read();
    if (!cookie !== !userInfo) {
      console.log("Unknown user model state; clearing");
      this.cookies.remove(COOKIE_NAME, { path: COOKIE_PATH });
      this.authStorage.clear();
    }
  }

  getUser(): User | null {
    const userInfo = this.authStorage.read();
    return userInfo ? new User(userInfo) : null;
  }

  getSessionCookie(): string | null {
    const cookie = this.cookies.get(COOKIE_NAME);
    console.log("auth model ctor: getSessionCookie", cookie);
    return cookie;
  }

  login(username: string, password: string): Promise<User> {
    const req = create(LoginRequestSchema, {
      username: username,
      password: password,
    });

    return this.authService.login(req).then((resp: LoginResponse) => {
      const cookie = resp.cookie;
      const userInfo = resp.userInfo;
      const expiry = new Date(Number(resp.expiry) * 1000);
      if (!cookie || !userInfo || !expiry) {
        console.log("bad login response");
        return Promise.reject(new Error("an error occurred"));
      }

      console.log("login: setting cookie", cookie);
      this.cookies.set(COOKIE_NAME, cookie, {
        expires: expiry,
        path: COOKIE_PATH,
        sameSite: true,
      });
      this.authStorage.write(userInfo);
      return new User(userInfo);
    });
  }

  // Calls made while a logout is in progress (e.g. from a component mounted
  // twice by React StrictMode) share it rather than sending another request.
  logout(): Promise<boolean> {
    if (this.pendingLogout) {
      return this.pendingLogout;
    }
    if (this.authStorage.read() === null) {
      return Promise.resolve(true);
    }

    const req = create(LogoutRequestSchema, {
      cookie: this.cookies.get(COOKIE_NAME),
    });
    this.pendingLogout = this.authService
      .logout(req)
      .then((unused: LogoutResponse) => {
        console.log("logout: clearing cookie");
        this.cookies.remove(COOKIE_NAME, { path: COOKIE_PATH });
        this.authStorage.clear();
        return true;
      })
      .finally(() => {
        this.pendingLogout = null;
      });
    return this.pendingLogout;
  }
}
