import { Metadata } from "grpc-web";
import { ListItem as ListItemProto } from "../proto/list_item_pb";
import { List as ListProto, ListData as ListDataProto } from "../proto/list_pb";
import { ListServicePromiseClient } from "../proto/list_service_grpc_web_pb";
import {
  ChangeActiveStateRequest,
  CreateListRequest,
  CreateListResponse,
  GetListRequest,
  GetListResponse,
  ListListItemsRequest,
  ListListItemsResponse,
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

  listLists(includeInactive: boolean): Promise<ListProto[]> {
    const req = new ListListsRequest();
    req.setIncludeInactive(includeInactive);

    return this.listService
      .listLists(req, this.metadata())
      .then((resp: ListListsResponse) => {
        return resp.getListsList();
      });
  }

  getList(listId: string): Promise<ListProto> {
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

  listListItems(listId: string): Promise<ListItemProto[]> {
    const req = new ListListItemsRequest();
    req.setListId(listId);

    return this.listService
      .listListItems(req, this.metadata())
      .then((resp: ListListItemsResponse) => {
        return resp.getItemsList();
      });
  }

  createList(listData: ListDataProto): Promise<ListProto> {
    const req = new CreateListRequest();
    req.setData(listData);

    return this.listService
      .createList(req, this.metadata())
      .then((resp: CreateListResponse) => {
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
    const req = new ChangeActiveStateRequest();
    req.setListId(listId);
    req.setListVersion(version);
    req.setNewState(newState);

    return this.listService.changeActiveState(req, this.metadata()).then(() => {
      Promise.resolve();
    });
  }

  private metadata(): Metadata {
    const cookie = this.authModel.getSessionCookie();
    return { authorization: cookie ? cookie : "" };
  }
}
