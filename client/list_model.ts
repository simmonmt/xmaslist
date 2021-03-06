import { Metadata } from "grpc-web";
import {
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
  DeleteListItemRequest,
  GetListRequest,
  GetListResponse,
  ListListItemsRequest,
  ListListItemsResponse,
  ListListsRequest,
  ListListsResponse,
  UpdateListItemRequest,
  UpdateListItemResponse,
  UpdateListRequest,
  UpdateListResponse,
} from "../proto/list_service_pb";
import { AuthModel } from "./auth_model";
import { ListItem } from "./list_item";

export class ListModel {
  private readonly listService: ListServicePromiseClient;
  private readonly authModel: AuthModel;

  constructor(listService: ListServicePromiseClient, authModel: AuthModel) {
    this.listService = listService;
    this.authModel = authModel;
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

  updateList(
    listId: string,
    version: number,
    data: ListDataProto
  ): Promise<ListProto> {
    const req = new UpdateListRequest();
    req.setListId(listId);
    req.setListVersion(version);
    req.setData(data);

    return this.listService
      .updateList(req, this.metadata())
      .then((resp: UpdateListResponse) => {
        const list = resp.getList();
        if (!list) {
          return Promise.reject(new Error("no list in response"));
        }

        return list;
      });
  }

  createListItem(
    listId: string,
    itemData: ListItemDataProto
  ): Promise<ListItem> {
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

        return new ListItem(item);
      });
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

  updateListItem(
    listId: string,
    itemId: string,
    itemVersion: number,
    newData: ListItemDataProto | null,
    newState: ListItemStateProto | null
  ): Promise<ListItem> {
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

        return new ListItem(item);
      });
  }

  deleteListItem(listId: string, itemId: string): Promise<void> {
    const req = new DeleteListItemRequest();
    req.setListId(listId);
    req.setItemId(itemId);

    return this.listService
      .deleteListItem(req, this.metadata())
      .then(() => Promise.resolve());
  }

  private metadata(): Metadata {
    const cookie = this.authModel.getSessionCookie();
    return { authorization: cookie ? cookie : "" };
  }

  listListItems(listId: string): Promise<ListItem[]> {
    const req = new ListListItemsRequest();
    req.setListId(listId);

    return this.listService
      .listListItems(req, this.metadata())
      .then((resp: ListListItemsResponse) => {
        return resp.getItemsList().map((proto) => new ListItem(proto));
      });
  }
}
