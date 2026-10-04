import { UserInfo } from "./gen/proto/user_info_pb";

export class User {
  readonly id: number;
  readonly username: string;
  readonly fullname: string;
  readonly isAdmin: boolean;

  constructor(userInfo: UserInfo) {
    const mkStr = (s: string | null): string => (s ? s : "UNKNOWN");

    this.id = Number(userInfo.id);
    this.username = mkStr(userInfo.username);
    this.fullname = mkStr(userInfo.fullname);
    this.isAdmin = Boolean(userInfo.isAdmin);
  }

  name(): string {
    return this.fullname ? this.fullname : this.username;
  }
}
