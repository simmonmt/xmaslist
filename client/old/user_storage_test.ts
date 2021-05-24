import { UserInfo } from "../proto/login_service_pb";
import { UserStorage } from "./user_storage";

describe("user storage", () => {
  const userInfo = new UserInfo();
  userInfo.setUsername("a");
  userInfo.setFullname("aa");

  beforeEach(function () {
    new UserStorage().clear();
  });

  it("reads nothing when nothing is stored", () => {
    expect(new UserStorage().read()).toBeNull();
  });

  it("reads written data", () => {
    const userStorage = new UserStorage();
    userStorage.write(userInfo);
    let readUserInfo = userStorage.read();
    expect(readUserInfo).not.toBeNull();
    expect(readUserInfo!.toString()).toBe(userInfo.toString());

    // Now use a newly-created UserStorage, which will read from local storage
    readUserInfo = new UserStorage().read();
    expect(readUserInfo).not.toBeNull();
    expect(readUserInfo!.toString()).toBe(userInfo.toString());
  });

  it("clears data", () => {
    const userStorage = new UserStorage();
    userStorage.write(userInfo);

    expect(userStorage.read()).not.toBeNull();
    userStorage.clear();
    expect(userStorage.read()).toBeNull();
  });
});
