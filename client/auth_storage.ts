import { UserInfo } from "../proto/user_info_pb";

export const STORAGE_NAME = "user_info";

export class AuthStorage {
  private userInfo: UserInfo | null;

  constructor() {
    this.userInfo = null;
  }

  read(): UserInfo | null {
    if (this.userInfo) {
      return this.userInfo;
    }

    let local = localStorage.getItem(STORAGE_NAME);
    if (!local) {
      return null;
    }

    console.log("AuthStorage read UserInfo from local storage");
    const ser = new Uint8Array(
      atob(local)
        .split("")
        .map(function (c) {
          return c.charCodeAt(0);
        })
    );
    this.userInfo = UserInfo.deserializeBinary(ser);
    return this.userInfo;
  }

  write(userInfo: UserInfo) {
    const ser = btoa(
      String.fromCharCode.apply(null, Array.from(userInfo.serializeBinary()))
    );
    localStorage.setItem(STORAGE_NAME, ser);

    this.userInfo = userInfo;
  }

  clear() {
    this.userInfo = null;
    localStorage.removeItem(STORAGE_NAME);
  }
}
