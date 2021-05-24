import { Metadata } from "grpc-web";
import { List } from "../proto/list_pb";
import { ListServicePromiseClient } from "../proto/list_service_grpc_web_pb";
import {
  GetListRequest,
  GetListResponse,
  ListListsRequest,
  ListListsResponse,
} from "../proto/list_service_pb";
import { UserModel } from "./auth_model";

export class ListModel {
  private readonly listService: ListServicePromiseClient;
  private readonly userModel: UserModel;

  constructor(listService: ListServicePromiseClient, userModel: UserModel) {
    this.listService = listService;
    this.userModel = userModel;
  }

  listLists(includeInactive: boolean): Promise<List[]> {
    const req = new ListListsRequest();
    req.setIncludeInactive(includeInactive);

    return this.listService
      .listLists(req, this.metadata())
      .then((resp: ListListsResponse) => {
        return resp.getListsList();
      });
  }

  getList(listId: string): Promise<List> {
    const req = new GetListRequest();
    req.setListId(listId);

    return this.listService
      .getList(req, this.metadata())
      .then((resp: GetListResponse) => {
        const list = resp.getList();
        if (!list) {
          return Promise.reject(new Error("no list in response"));
        }

        return list;
      });
  }

  private metadata(): Metadata {
    const cookie = this.userModel.getSessionCookie();
    return { authorization: cookie ? cookie : "" };
  }
}
