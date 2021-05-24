import Cookies from "universal-cookie";
import { LoginServicePromiseClient } from "../proto/login_service_grpc_web_pb";
import {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
} from "../proto/login_service_pb";
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
  private readonly userService: LoginServicePromiseClient;
  private readonly userStorage: AuthStorage;
  private readonly cookies: Cookies;

  constructor(
    userService: LoginServicePromiseClient,
    userStorage: AuthStorage,
    cookies: Cookies
  ) {
    this.userService = userService;
    this.userStorage = userStorage;
    this.cookies = cookies;

    const cookie = this.cookies.get(COOKIE_NAME);
    const userInfo = this.userStorage.read();
    if (!cookie !== !userInfo) {
      console.log("Unknown user model state; clearing");
      this.cookies.remove(COOKIE_NAME);
      this.userStorage.clear();
    }
  }

  getUser(): User | null {
    const userInfo = this.userStorage.read();
    return userInfo ? new User(userInfo) : null;
  }

  getSessionCookie(): string | null {
    return this.cookies.get(COOKIE_NAME);
  }

  login(username: string, password: string): Promise<User> {
    let req = new LoginRequest();
    req.setUsername(username);
    req.setPassword(password);

    return this.userService
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
        this.userStorage.write(userInfo);
        return new User(userInfo);
      });
  }

  logout(): Promise<boolean> {
    if (this.userStorage.read() === null) {
      return Promise.resolve(true);
    }

    let req = new LogoutRequest();
    req.setCookie(this.cookies.get(COOKIE_NAME));
    return this.userService
      .logout(req, undefined)
      .then((unused: LogoutResponse) => {
        this.cookies.remove(COOKIE_NAME);
        this.userStorage.clear();
        return true;
      });
  }
}
