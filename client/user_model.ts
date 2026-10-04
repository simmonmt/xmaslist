import { create } from "@bufbuild/protobuf";
import { CallOptions, Client } from "@connectrpc/connect";
import { AuthModel } from "./auth_model";
import {
  GetUsersRequestSchema,
  GetUsersResponse,
  UserService,
} from "./gen/proto/user_service_pb";
import { User } from "./user";

export class UserModel {
  private readonly userService: Client<typeof UserService>;
  private readonly authModel: AuthModel;
  private users = new Map<number, User>();
  private badUsers = new Set<number>();

  constructor(userService: Client<typeof UserService>, authModel: AuthModel) {
    this.userService = userService;
    this.authModel = authModel;
  }

  getUser(id: number): User | undefined {
    return this.users.get(id);
  }

  getUserAsync(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      return Promise.resolve(user);
    }

    return this.loadUsers([id]).then(() => Promise.resolve(this.getUser(id)));
  }

  loadUsers(ids: number[]): Promise<boolean> {
    let missingIds = new Set<number>();
    for (const id of ids) {
      if (!this.users.has(id) && !this.badUsers.has(id)) {
        missingIds.add(id);
      }
    }

    if (!missingIds.size) {
      return Promise.resolve(true);
    }

    const req = create(GetUsersRequestSchema, {
      ids: Array.from(missingIds.values()),
    });

    return this.userService
      .getUsers(req, this.callOptions())
      .then((resp: GetUsersResponse) => {
        for (const userInfo of resp.users) {
          const user = new User(userInfo);
          this.users.set(user.id, user);
          missingIds.delete(user.id);
        }

        for (const id of Array.from(missingIds.values())) {
          this.badUsers.add(id);
        }

        return Promise.resolve(true);
      });
  }

  private callOptions(): CallOptions {
    const cookie = this.authModel.getSessionCookie();
    return { headers: { authorization: cookie ? cookie : "" } };
  }
}
