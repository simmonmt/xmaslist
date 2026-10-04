import { clone } from "@bufbuild/protobuf";
import {
  ListItemData as ListItemDataProto,
  ListItemDataSchema,
  ListItemMetadata as ListItemMetadataProto,
  ListItem as ListItemProto,
  ListItemState as ListItemStateProto,
  ListItemStateSchema,
} from "./gen/proto/list_item_pb";

export class ListItem {
  private readonly data: ListItemDataProto;
  private readonly state: ListItemStateProto;
  private readonly metadata: ListItemMetadataProto;

  constructor(private readonly proto: ListItemProto) {
    const data = proto.data;
    const metadata = proto.metadata;
    const state = proto.state;
    if (
      !proto.id ||
      !proto.version ||
      !proto.listId ||
      !data ||
      !metadata ||
      !state ||
      !data.name
    ) {
      throw new Error("malformed");
    }

    if (state.claimed && !metadata.claimedBy) {
      throw new Error("bad claim state");
    }

    this.data = data;
    this.metadata = metadata;
    this.state = state;
  }

  getItemId(): string {
    return this.proto.id;
  }

  getItemVersion(): number {
    return this.proto.version;
  }

  getListId(): string {
    return this.proto.listId;
  }

  isClaimed(): boolean {
    return this.state.claimed;
  }

  getClaimedBy(): number | undefined {
    if (!this.isClaimed()) {
      return undefined;
    }
    return this.metadata.claimedBy;
  }

  getName(): string {
    return this.data.name;
  }

  getDesc(): string {
    return this.data.desc;
  }

  getUrl(): string {
    return this.data.url;
  }

  getData(): ListItemDataProto {
    return clone(ListItemDataSchema, this.data);
  }

  getState(): ListItemStateProto {
    return clone(ListItemStateSchema, this.state);
  }
}
