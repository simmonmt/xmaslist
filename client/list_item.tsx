import {
  ListItemData as ListItemDataProto,
  ListItemMetadata as ListItemMetadataProto,
  ListItem as ListItemProto,
  ListItemState as ListItemStateProto,
} from "xmaslist-proto/proto/list_item_pb.js";

export class ListItem {
  private readonly data: ListItemDataProto;
  private readonly state: ListItemStateProto;
  private readonly metadata: ListItemMetadataProto;

  constructor(private readonly proto: ListItemProto) {
    const data = proto.getData();
    const metadata = proto.getMetadata();
    const state = proto.getState();
    if (
      !proto.getId() ||
      !proto.getVersion() ||
      !proto.getListId() ||
      !data ||
      !metadata ||
      !state ||
      !data.getName()
    ) {
      throw new Error("malformed");
    }

    if (state.getClaimed() && !metadata.getClaimedBy()) {
      throw new Error("bad claim state");
    }

    this.data = data;
    this.metadata = metadata;
    this.state = state;
  }

  getItemId(): string {
    return this.proto.getId();
  }

  getItemVersion(): number {
    return this.proto.getVersion();
  }

  getListId(): string {
    return this.proto.getListId();
  }

  isClaimed(): boolean {
    return this.state.getClaimed();
  }

  getClaimedBy(): number | undefined {
    if (!this.isClaimed()) {
      return undefined;
    }
    return this.metadata.getClaimedBy();
  }

  getName(): string {
    return this.data.getName();
  }

  getDesc(): string {
    return this.data.getDesc();
  }

  getUrl(): string {
    return this.data.getUrl();
  }

  getData(): ListItemDataProto {
    return this.data.cloneMessage();
  }

  getState(): ListItemStateProto {
    return this.state.cloneMessage();
  }
}
