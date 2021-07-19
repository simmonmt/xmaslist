import { Metadata } from "grpc-web";
import {
  ListItem as ListItemProto,
  ListItemData as ListItemDataProto,
  ListItemState as ListItemStateProto,
} from "../proto/list_item_pb";
import { List as ListProto, ListData as ListDataProto } from "../proto/list_pb";
import { ListServicePromiseClient } from "../proto/list_service_grpc_web_pb";
import {
  ChangeActiveStateRequest,
  CreateListItemRequest,
  CreateListItemResponse,
  CreateListRequest,
  CreateListResponse,
  GetListRequest,
  GetListResponse,
  ListListItemsRequest,
  ListListItemsResponse,
  ListListsRequest,
  ListListsResponse,
  UpdateListItemRequest,
  UpdateListItemResponse,
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

  createListItem(
    listId: string,
    itemData: ListItemDataProto
  ): Promise<ListItemProto> {
    const req = new CreateListItemRequest();
    req.setListId(listId);
    req.setData(itemData);

    return this.listService
      .createListItem(req, this.metadata())
      .then((resp: CreateListItemResponse) => {
        const item = resp.getItem();
        if (!item) {
          return Promise.reject(new Error("no item in response"));
        }

        return item;
      });
  }

  updateListItem(
    listId: string,
    itemId: string,
    itemVersion: number,
    newData: ListItemDataProto | null,
    newState: ListItemStateProto | null
  ): Promise<ListItemProto> {
    const req = new UpdateListItemRequest();
    req.setListId(listId);
    req.setItemId(itemId);
    req.setItemVersion(itemVersion);

    if (newData) {
      req.setData(newData);
    }
    if (newState) {
      req.setState(newState);
    }

    return this.listService
      .updateListItem(req, this.metadata())
      .then((resp: UpdateListItemResponse) => {
        const item = resp.getItem();
        if (!item) {
          return Promise.reject(new Error("no item in response"));
        }

        return item;
      });
  }

  private metadata(): Metadata {
    const cookie = this.authModel.getSessionCookie();
    return { authorization: cookie ? cookie : "" };
  }
}
