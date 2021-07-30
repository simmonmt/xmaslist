import {
  ListItem as ListItemProto,
  ListItemData as ListItemDataProto,
  ListItemState as ListItemStateProto,
} from "../proto/list_item_pb";
import { User } from "./user";

export class ListItem {
  private readonly data: ListItemDataProto;
  private readonly state: ListItemStateProto;

  constructor(
    private readonly proto: ListItemProto,
    private readonly claimUser: User | undefined
  ) {
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

    if (state.getClaimed()) {
      if (
        !metadata.getClaimedBy() ||
        !claimUser ||
        metadata.getClaimedBy() != claimUser.id
      ) {
        throw new Error("bad claim state");
      }
    }

    this.data = data;
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

  getClaimUser(): User | undefined {
    if (!this.isClaimed()) {
      return undefined;
    }
    return this.claimUser;
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
