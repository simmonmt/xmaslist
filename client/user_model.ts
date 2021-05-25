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

  getUser(id: number): User | undefined {
    return this.users.get(id);
  }

  loadUsers(ids: number[]): Promise<boolean> {
    let missingIds = new Set<number>();
    for (const id of ids) {
      if (!this.users.has(id) && !this.badUsers.has(id)) {
        missingIds.add(id);
      }
    }
    console.log("loadusers missingids", missingIds);

    if (!missingIds.size) {
      return Promise.resolve(true);
    }

    const req = new GetUsersRequest();
    req.setIdsList(Array.from(missingIds.values()));
    console.log("fetching", Array.from(missingIds.values()));

    return this.userService
      .getUsers(req, this.metadata())
      .then((resp: GetUsersResponse) => {
        for (const userInfo of resp.getUsersList()) {
          const user = new User(userInfo);
          this.users.set(user.id, user);
          missingIds.delete(user.id);
          console.log("got", user.id);
        }

        console.log("still missing", Array.from(missingIds.values()));
        for (const id of Array.from(missingIds.values())) {
          this.badUsers.add(id);
        }

        return Promise.resolve(true);
      });
  }

  private metadata(): Metadata {
    const cookie = this.authModel.getSessionCookie();
    return { authorization: cookie ? cookie : "" };
  }
}
