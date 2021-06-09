import { Metadata } from "grpc-web";
import { List } from "../proto/list_pb";
import { ListServicePromiseClient } from "../proto/list_service_grpc_web_pb";
import {
  GetListRequest,
  GetListResponse,
  ListListsRequest,
  ListListsResponse,
} from "../proto/list_service_pb";
import { AuthModel } from "./auth_model";

export class ListModel {
  private readonly listService: ListServicePromiseClient;
  private readonly authModel: AuthModel;

  constructor(listService: ListServicePromiseClient, authModel: AuthModel) {
    this.listService = listService;
    this.authModel = authModel;
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

  changeActiveState(
    listId: string,
    version: number,
    newState: boolean
  ): Promise<void> {
    console.log("request to change", listId, "to state", newState);
    return Promise.resolve();
  }

  private metadata(): Metadata {
    const cookie = this.authModel.getSessionCookie();
    return { authorization: cookie ? cookie : "" };
  }
}
