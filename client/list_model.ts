import { create } from "@bufbuild/protobuf";
import { CallOptions, Client } from "@connectrpc/connect";
import { AuthModel } from "./auth_model";
import {
  ListItemData as ListItemDataProto,
  ListItemState as ListItemStateProto,
} from "./gen/proto/list_item_pb";
import {
  ListData as ListDataProto,
  List as ListProto,
} from "./gen/proto/list_pb";
import {
  ChangeActiveStateRequestSchema,
  CreateListItemRequestSchema,
  CreateListItemResponse,
  CreateListRequestSchema,
  CreateListResponse,
  DeleteListItemRequestSchema,
  GetListRequestSchema,
  GetListResponse,
  ListListItemsRequestSchema,
  ListListItemsResponse,
  ListListsRequestSchema,
  ListListsResponse,
  ListService,
  UpdateListItemRequestSchema,
  UpdateListItemResponse,
  UpdateListRequestSchema,
  UpdateListResponse,
} from "./gen/proto/list_service_pb";
import { ListItem } from "./list_item";

export class ListModel {
  private readonly listService: Client<typeof ListService>;
  private readonly authModel: AuthModel;

  constructor(listService: Client<typeof ListService>, authModel: AuthModel) {
    this.listService = listService;
    this.authModel = authModel;
  }

  createList(listData: ListDataProto): Promise<ListProto> {
    const req = create(CreateListRequestSchema, { data: listData });

    return this.listService
      .createList(req, this.callOptions())
      .then((resp: CreateListResponse) => {
        const list = resp.list;
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
    const req = create(ChangeActiveStateRequestSchema, {
      listId: listId,
      listVersion: version,
      newState: newState,
    });

    return this.listService
      .changeActiveState(req, this.callOptions())
      .then(() => {
        Promise.resolve();
      });
  }

  updateList(
    listId: string,
    version: number,
    data: ListDataProto
  ): Promise<ListProto> {
    const req = create(UpdateListRequestSchema, {
      listId: listId,
      listVersion: version,
      data: data,
    });

    return this.listService
      .updateList(req, this.callOptions())
      .then((resp: UpdateListResponse) => {
        const list = resp.list;
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
    const req = create(CreateListItemRequestSchema, {
      listId: listId,
      data: itemData,
    });

    return this.listService
      .createListItem(req, this.callOptions())
      .then((resp: CreateListItemResponse) => {
        const item = resp.item;
        if (!item) {
          return Promise.reject(new Error("no item in response"));
        }

        return new ListItem(item);
      });
  }

  listLists(includeInactive: boolean): Promise<ListProto[]> {
    const req = create(ListListsRequestSchema, {
      includeInactive: includeInactive,
    });

    return this.listService
      .listLists(req, this.callOptions())
      .then((resp: ListListsResponse) => {
        return resp.lists;
      });
  }

  getList(listId: string): Promise<ListProto> {
    const req = create(GetListRequestSchema, { listId: listId });

    return this.listService
      .getList(req, this.callOptions())
      .then((resp: GetListResponse) => {
        const list = resp.list;
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
    const req = create(UpdateListItemRequestSchema, {
      listId: listId,
      itemId: itemId,
      itemVersion: itemVersion,
    });

    if (newData) {
      req.data = newData;
    }
    if (newState) {
      req.state = newState;
    }

    return this.listService
      .updateListItem(req, this.callOptions())
      .then((resp: UpdateListItemResponse) => {
        const item = resp.item;
        if (!item) {
          return Promise.reject(new Error("no item in response"));
        }

        return new ListItem(item);
      });
  }

  deleteListItem(listId: string, itemId: string): Promise<void> {
    const req = create(DeleteListItemRequestSchema, {
      listId: listId,
      itemId: itemId,
    });

    return this.listService
      .deleteListItem(req, this.callOptions())
      .then(() => Promise.resolve());
  }

  private callOptions(): CallOptions {
    const cookie = this.authModel.getSessionCookie();
    return { headers: { authorization: cookie ? cookie : "" } };
  }

  listListItems(listId: string): Promise<ListItem[]> {
    const req = create(ListListItemsRequestSchema, { listId: listId });

    return this.listService
      .listListItems(req, this.callOptions())
      .then((resp: ListListItemsResponse) => {
        return resp.items.map((proto) => new ListItem(proto));
      });
  }
}
