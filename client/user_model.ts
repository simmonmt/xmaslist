import { Cookies } from "react-cookie";
import { UserServicePromiseClient } from "../proto/user_service_grpc_web_pb";
import {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  UserInfo,
} from "../proto/user_service_pb";

const COOKIE_NAME = "session";

export class UserModel {
  private readonly userService: UserServicePromiseClient;
  private readonly cookies: Cookies;
  private userInfo: UserInfo | null;

  constructor(userService: UserServicePromiseClient, cookies: Cookies) {
    this.userService = userService;
    this.cookies = cookies;
    this.userInfo = null;

    const { cookie, userInfo } = this.getBrowserState();
    if (cookie && userInfo) {
      this.userInfo = userInfo;
    } else {
      this.clearBrowserState(); // Unknown state -- revert
    }
  }

  username(): string {
    return this.userInfo ? this.userInfo.getUsername() : "";
  }
  fullname(): string {
    return this.userInfo ? this.userInfo.getFullname() : "";
  }
  isAdmin(): boolean {
    return this.userInfo ? this.userInfo.getIsAdmin() : false;
  }
  isLoggedIn(): boolean {
    return this.userInfo != null;
  }

  login(username: string, password: string): Promise<boolean> {
    let req = new LoginRequest();
    req.setUsername(username);
    req.setPassword(password);

    return this.userService.login(req, undefined).then(
      (resp: LoginResponse) => {
        if (resp.getSuccess()) {
          const cookie = resp.getCookie();
          const userInfo = resp.getUserInfo();
          const expiry = new Date(resp.getExpiry() * 1000);
          if (!cookie || !userInfo || !expiry) {
            console.log("bad login response");
            return Promise.reject(new Error("an error occurred"));
          }

          this.setBrowserState(cookie, expiry, userInfo);
          this.userInfo = userInfo;
          return true;
        }
        return Promise.reject(new Error("invalid username or password"));
      },
      (err: Error) => {
        console.log("Login failure", err);
        return Promise.reject(new Error("an error occurred"));
      }
    );
  }

  logout(): Promise<boolean> {
    if (!this.isLoggedIn()) {
      return Promise.reject(new Error("not logged in"));
    }

    let req = new LogoutRequest();
    req.setCookie(this.cookies.get(COOKIE_NAME));
    return this.userService
      .logout(req, undefined)
      .then((unused: LogoutResponse) => {
        this.clearBrowserState();
        this.userInfo = null;
        return true;
      });
  }

  private getBrowserState() {
    let userInfo: UserInfo | null = null;

    let local = localStorage.getItem(COOKIE_NAME);
    if (local) {
      const ser = new Uint8Array(
        atob(local)
          .split("")
          .map(function (c) {
            return c.charCodeAt(0);
          })
      );
      userInfo = UserInfo.deserializeBinary(ser);
    }

    return {
      cookie: this.cookies.get(COOKIE_NAME),
      userInfo: userInfo,
    };
  }

  private setBrowserState(cookie: string, expiry: Date, userInfo: UserInfo) {
    this.cookies.set(COOKIE_NAME, cookie, {
      expires: expiry,
      sameSite: true,
    });

    const ser = btoa(
      String.fromCharCode.apply(null, Array.from(userInfo.serializeBinary()))
    );
    localStorage.setItem(COOKIE_NAME, ser);
  }

  private clearBrowserState() {
    this.cookies.remove(COOKIE_NAME);
    localStorage.removeItem(COOKIE_NAME);
  }
}
