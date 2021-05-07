import Cookies from "universal-cookie";
import { UserServicePromiseClient } from "../proto/user_service_grpc_web_pb";
import {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
} from "../proto/user_service_pb";
import { UserStorage } from "./user_storage";

const COOKIE_NAME = "session";

export class UserModel {
  private readonly userService: UserServicePromiseClient;
  private readonly userStorage: UserStorage;
  private readonly cookies: Cookies;

  constructor(
    userService: UserServicePromiseClient,
    userStorage: UserStorage,
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

  username(): string {
    const userInfo = this.userStorage.read();
    return userInfo ? userInfo.getUsername() : "";
  }
  fullname(): string {
    const userInfo = this.userStorage.read();
    return userInfo ? userInfo.getFullname() : "";
  }
  isAdmin(): boolean {
    const userInfo = this.userStorage.read();
    return userInfo ? userInfo.getIsAdmin() : false;
  }
  isLoggedIn(): boolean {
    return this.userStorage.read() !== null;
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

          this.cookies.set(COOKIE_NAME, cookie, {
            expires: expiry,
            sameSite: true,
          });
          this.userStorage.write(userInfo);
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
