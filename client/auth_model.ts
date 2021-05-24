import Cookies from "universal-cookie";
import { AuthServicePromiseClient } from "../proto/auth_service_grpc_web_pb";
import {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
} from "../proto/auth_service_pb";
import { UserInfo } from "../proto/user_info_pb";
import { AuthStorage } from "./auth_storage";

const COOKIE_NAME = "session";

export class User {
  readonly username: string;
  readonly fullname: string;
  readonly isAdmin: boolean;

  constructor(userInfo: UserInfo) {
    const mkStr = (s: string | null): string => (s ? s : "UNKNOWN");

    this.username = mkStr(userInfo.getUsername());
    this.fullname = mkStr(userInfo.getFullname());
    this.isAdmin = Boolean(userInfo.getIsAdmin());
  }
}

export class AuthModel {
  private readonly authService: AuthServicePromiseClient;
  private readonly authStorage: AuthStorage;
  private readonly cookies: Cookies;

  constructor(
    authService: AuthServicePromiseClient,
    authStorage: AuthStorage,
    cookies: Cookies
  ) {
    this.authService = authService;
    this.authStorage = authStorage;
    this.cookies = cookies;

    const cookie = this.cookies.get(COOKIE_NAME);
    const userInfo = this.authStorage.read();
    if (!cookie !== !userInfo) {
      console.log("Unknown user model state; clearing");
      this.cookies.remove(COOKIE_NAME);
      this.authStorage.clear();
    }
  }

  getUser(): User | null {
    const userInfo = this.authStorage.read();
    return userInfo ? new User(userInfo) : null;
  }

  getSessionCookie(): string | null {
    return this.cookies.get(COOKIE_NAME);
  }

  login(username: string, password: string): Promise<User> {
    let req = new LoginRequest();
    req.setUsername(username);
    req.setPassword(password);

    return this.authService
      .login(req, undefined)
      .then((resp: LoginResponse) => {
        const cookie = resp.getCookie();
        const userInfo = resp.getUserInfo();
        const expiry = new Date(resp.getExpiry() * 1000);
        if (!cookie || !userInfo || !expiry) {
          console.log("bad login response");
          return Promise.reject(new Error("an error occurred"));
        }

        this.cookies.set(COOKIE_NAME, cookie, {
          expires: expiry,
          sameSite: true,
        });
        this.authStorage.write(userInfo);
        return new User(userInfo);
      });
  }

  logout(): Promise<boolean> {
    if (this.authStorage.read() === null) {
      return Promise.resolve(true);
    }

    let req = new LogoutRequest();
    req.setCookie(this.cookies.get(COOKIE_NAME));
    return this.authService
      .logout(req, undefined)
      .then((unused: LogoutResponse) => {
        this.cookies.remove(COOKIE_NAME);
        this.authStorage.clear();
        return true;
      });
  }
}
