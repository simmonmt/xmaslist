import { UserServicePromiseClient } from "../proto/user_service_grpc_web_pb";
import {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  UserInfo,
} from "../proto/user_service_pb";

export class UserModel {
  private readonly userService: UserServicePromiseClient;
  private cookie: string;
  private userInfo: UserInfo | null;

  constructor(userService: UserServicePromiseClient) {
    this.userService = userService;
    this.cookie = "";
    this.userInfo = null;
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
    return this.cookie.length != 0;
  }

  login(username: string, password: string): Promise<boolean> {
    let req = new LoginRequest();
    req.setUsername(username);
    req.setPassword(password);

    return this.userService.login(req, undefined).then(
      (resp: LoginResponse) => {
        if (resp.getSuccess()) {
          const userInfo = resp.getUserInfo();
          if (!userInfo) {
            console.log("bad login response");
            return Promise.reject(new Error("an error occurred"));
          }

          this.cookie = resp.getCookie();
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
    if (this.cookie.length === 0) {
      return Promise.reject(new Error("not logged in"));
    }

    let req = new LogoutRequest();
    req.setCookie(this.cookie);
    return this.userService
      .logout(req, undefined)
      .then((unused: LogoutResponse) => {
        return true;
      });
  }
}
