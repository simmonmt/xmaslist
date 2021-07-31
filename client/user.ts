import { UserInfo } from "../proto/user_info_pb";

export class User {
  readonly id: number;
  readonly username: string;
  readonly fullname: string;
  readonly isAdmin: boolean;

  constructor(userInfo: UserInfo) {
    const mkStr = (s: string | null): string => (s ? s : "UNKNOWN");

    this.id = Number(userInfo.getId());
    this.username = mkStr(userInfo.getUsername());
    this.fullname = mkStr(userInfo.getFullname());
    this.isAdmin = Boolean(userInfo.getIsAdmin());
  }

  name(): string {
    return this.fullname ? this.fullname : this.username;
  }
}
