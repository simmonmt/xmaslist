import { Metadata } from "grpc-web";
import { UserServicePromiseClient } from "../proto/user_service_grpc_web_pb";
import { GetUsersRequest, GetUsersResponse } from "../proto/user_service_pb";
import { User } from "./user";
import { AuthModel } from "./auth_model";

export class UserModel {
  private readonly userService: UserServicePromiseClient;
  private readonly authModel: AuthModel;
  private users = new Map<number, User>();
  private badUsers = new Set<number>();

  constructor(userService: UserServicePromiseClient, authModel: AuthModel) {
    this.userService = userService;
    this.authModel = authModel;
  }

  getUsers(ids: number[]): Promise<User[]> {
    const res: User[] = [];
    let missingIds = new Set<number>();
    for (const id of ids) {
      let user = this.users.get(id);
      if (user) {
        res.push(user);
      } else if (!this.badUsers.has(id)) {
        missingIds.add(id);
      }
    }

    if (!missingIds.size) {
      return Promise.resolve(res);
    }

    const req = new GetUsersRequest();
    req.setIdsList(Array.from(missingIds.values()));

    return this.userService
      .getUsers(req, this.metadata())
      .then((resp: GetUsersResponse) => {
        for (const userInfo of resp.getUsersList()) {
          const user = new User(userInfo);
          this.users.set(user.id, user);
          missingIds.delete(user.id);
          res.push(user);
        }

        for (const id of Array.from(missingIds.values())) {
          this.badUsers.add(id);
        }

        return res;
      });
  }

  private metadata(): Metadata {
    const cookie = this.authModel.getSessionCookie();
    return { authorization: cookie ? cookie : "" };
  }
}
