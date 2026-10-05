import { Code, ConnectError } from "@connectrpc/connect";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import { grey } from "@mui/material/colors";
import Fab from "@mui/material/Fab";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import LinearProgress from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { format as formatDate, isPast as isPastDate } from "date-fns";
import * as React from "react";
import { RouteComponentProps } from "react-router";
import { Redirect, Link as RouterLink, withRouter } from "react-router-dom";
import { EditListDialog } from "./edit_list_dialog";
import { EditListItemDialog } from "./edit_list_item_dialog";
import {
  ListItemData as ListItemDataProto,
  ListItem as ListItemProto,
  ListItemState as ListItemStateProto,
} from "./gen/proto/list_item_pb";
import {
  ListData as ListDataProto,
  List as ListProto,
} from "./gen/proto/list_pb";
import { ItemListElement, ItemListElementMode } from "./item_list_element";
import { ListItem } from "./list_item";
import { ListModel } from "./list_model";
import { ProgressButton } from "./progress_button";
import { ProgressDialog } from "./progress_dialog";
import { User } from "./user";
import { UserModel } from "./user_model";

interface PathParams {
  listId: string;
}

export interface ListItemUpdater {
  updateData: (
    itemId: string,
    itemVersion: number,
    data: ListItemDataProto
  ) => Promise<void>;

  updateState: (
    itemId: string,
    itemVersion: number,
    state: ListItemStateProto
  ) => Promise<void>;

  delete: (itemId: string) => Promise<void>;
}

export interface ItemListApiArgs {
  key: string;
  item: ListItemProto;
  currentUser: User;
  itemUpdater: ListItemUpdater;
}

export type ItemListMode = "view" | "edit";

export interface Props extends RouteComponentProps<PathParams> {
  listModel: ListModel;
  userModel: UserModel;
  currentUser: User;
  mode: ItemListMode;
}

const Root = styled("div")({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
});

const ListCard = styled(Card)({
  margin: "1em",
});

const ListMeta = styled("div")({
  textAlign: "center",
});

const ListMetaFor = styled("span")(({ theme }) => ({
  marginRight: theme.spacing(2),
}));

const CreateFab = styled(Fab)(({ theme }) => ({
  position: "absolute",
  bottom: theme.spacing(2),
  right: theme.spacing(2),
}));

const EmptyList = styled("div")({
  color: grey[400],
  flexGrow: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",

  "& > *": { textAlign: "center" },
});

const EmptyEmoji = styled(Typography)({
  fontFamily: "Arial",
  marginBottom: "1rem",
});

const Buttons = styled("div")({
  display: "flex",
  justifyContent: "flex-end",
});

interface State {
  loggedIn: boolean;
  loading: boolean;
  errorMessage: string;
  list: ListProto | null;
  listOwner: User | undefined;
  items: ListItem[];
  adminMode: boolean;
  createItemDialogOpen: boolean;
  creatingItemDialogOpen: boolean;
  modifyListDialogOpen: boolean;
  modifyingList: boolean;
}

class ItemList extends React.Component<Props, State> {
  private readonly listId: string;
  private readonly itemUpdater: ListItemUpdater;

  constructor(props: Props) {
    super(props);
    this.state = {
      loggedIn: true,
      loading: false,
      errorMessage: "",
      list: null,
      listOwner: undefined,
      items: [],
      adminMode: false,
      createItemDialogOpen: false,
      creatingItemDialogOpen: false,
      modifyListDialogOpen: false,
      modifyingList: false,
    };

    this.listId = this.props.match.params.listId;
    this.itemUpdater = {
      updateData: this.updateListItemData.bind(this),
      updateState: this.updateListItemState.bind(this),
      delete: this.deleteListItem.bind(this),
    };

    this.handleAlertClose = this.handleAlertClose.bind(this);
    this.handleCreateClick = this.handleCreateClick.bind(this);
    this.handleCreateItemDialogClose =
      this.handleCreateItemDialogClose.bind(this);
    this.handleModifyListClick = this.handleModifyListClick.bind(this);
    this.handleModifyListDialogClose =
      this.handleModifyListDialogClose.bind(this);
    this.handleAdminModeChange = this.handleAdminModeChange.bind(this);
  }

  componentDidMount() {
    this.loadData();
  }

  render() {
    let eventIsPast = false;
    let userIsOwner = false;
    if (this.state.list) {
      const data = this.state.list.data;
      eventIsPast = isPastDate(new Date(Number(data && data.eventDate) * 1000));

      const metadata = this.state.list.metadata;
      userIsOwner =
        Number(metadata && metadata.owner) === this.props.currentUser.id;
    }

    const showAdminModeToggle =
      this.props.currentUser.isAdmin || (userIsOwner && eventIsPast);
    const elementMode: ItemListElementMode = this.state.adminMode
      ? "admin"
      : this.props.mode;

    return (
      <Root>
        {!this.state.loggedIn && <Redirect to="/logout" />}
        {this.state.loading && <LinearProgress />}
        {this.state.errorMessage && (
          <Alert
            severity="error"
            variant="standard"
            onClose={this.handleAlertClose}
          >
            Error: {this.state.errorMessage}
          </Alert>
        )}
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body1">
            <RouterLink to="/">&lt;&lt; All lists</RouterLink>
          </Typography>
          <FormGroup row>
            {showAdminModeToggle && (
              <FormControlLabel
                control={
                  <Switch
                    checked={this.state.adminMode}
                    onChange={this.handleAdminModeChange}
                  />
                }
                label="Show Claim State"
              />
            )}
          </FormGroup>
        </Box>

        <ListCard raised>{this.listMeta()}</ListCard>

        {this.state.items.length > 0 && (
          <ListCard raised>{this.listItems(elementMode)}</ListCard>
        )}

        {this.state.items.length === 0 && !this.state.loading && (
          <EmptyList>
            <EmptyEmoji variant="h1">( •́ω•̩̥̀ )</EmptyEmoji>
            <Typography variant="h4">This list is empty</Typography>
          </EmptyList>
        )}

        {this.props.mode == "edit" && (
          <div>
            <CreateFab
              color="primary"
              aria-label="create"
              onClick={this.handleCreateClick}
            >
              <AddIcon />
            </CreateFab>
            <EditListItemDialog
              action="Create"
              open={this.state.createItemDialogOpen}
              onClose={this.handleCreateItemDialogClose}
              initial={null}
            />
            <ProgressDialog
              open={this.state.creatingItemDialogOpen}
              label="Creating Item"
            />
          </div>
        )}

        {this.state.list && (
          <EditListDialog
            action="Modify"
            open={this.state.modifyListDialogOpen}
            onClose={this.handleModifyListDialogClose}
            initial={this.state.list.data || null}
          />
        )}
      </Root>
    );
  }

  private handleCreateClick() {
    this.setState({ createItemDialogOpen: true });
  }

  private handleCreateItemDialogClose(itemData: ListItemDataProto | null) {
    this.setState({
      createItemDialogOpen: false,
      creatingItemDialogOpen: itemData !== null,
    });
    if (!itemData) {
      return;
    }

    this.props.listModel
      .createListItem(this.listId, itemData)
      .then((item: ListItem) => {
        const copy = this.state.items.slice();
        copy.push(item);

        this.setState({ creatingItemDialogOpen: false, items: copy });
      })
      .catch((e) => {
        const error = ConnectError.from(e);
        if (error.code === Code.Unauthenticated) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          creatingItemDialogOpen: false,
          errorMessage: error.rawMessage || "Unknown error",
        });
      });
  }

  private handleModifyListClick() {
    this.setState({ modifyListDialogOpen: true });
  }

  private handleModifyListDialogClose(data: ListDataProto | null) {
    this.setState({
      modifyListDialogOpen: false,
      modifyingList: data !== null && this.state.list !== null,
    });
    if (!data || !this.state.list) {
      return;
    }

    this.props.listModel
      .updateList(this.state.list.id, this.state.list.version, data)
      .then((list: ListProto) => {
        this.setState({ modifyingList: false, list: list });
      })
      .catch((e) => {
        const error = ConnectError.from(e);
        if (error.code === Code.Unauthenticated) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          modifyingList: false,
          errorMessage: error.rawMessage || "Unknown error",
        });
      });
  }

  private handleAdminModeChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ adminMode: event.target.checked });
  }

  private listMeta() {
    if (!this.state.list || !this.state.listOwner) return;

    const data = this.state.list.data!;
    return (
      <ListMeta>
        <Typography variant="h2">{data.name}</Typography>
        <Typography variant="body1">
          {
            // Long localized date
            formatDate(new Date(Number(data.eventDate) * 1000), "PPPP")
          }
        </Typography>
        <div>
          <ListMetaFor>
            <Typography variant="body1" component="span" color="textSecondary">
              For:
            </Typography>{" "}
            <Typography variant="body1" component="span">
              {data.beneficiary}
            </Typography>
          </ListMetaFor>
          <span>
            <Typography variant="body1" component="span" color="textSecondary">
              By:
            </Typography>{" "}
            <Typography variant="body1" component="span">
              {this.state.listOwner.name()}
            </Typography>
          </span>
        </div>
        {this.props.mode == "edit" && (
          <Buttons>
            <ProgressButton
              updating={this.state.modifyingList}
              onClick={this.handleModifyListClick}
            >
              Edit
            </ProgressButton>
          </Buttons>
        )}
      </ListMeta>
    );
  }

  private makeItemListItem(item: ListItem, mode: ItemListElementMode) {
    return (
      <ItemListElement
        key={item.getItemId()}
        mode={mode}
        item={item}
        itemUpdater={this.itemUpdater}
        currentUser={this.props.currentUser}
        userModel={this.props.userModel}
      />
    );
  }

  private listItems(elementMode: ItemListElementMode) {
    return (
      <div>
        {this.state.items.map((item) =>
          this.makeItemListItem(item, elementMode)
        )}
      </div>
    );
  }

  private makeUpdatedItems(
    id: string,
    updater: (item: ListItem) => ListItem
  ): ListItem[] {
    const tmp = this.state.items.slice();
    for (let i = 0; i < tmp.length; ++i) {
      if (tmp[i].getItemId() === id) {
        tmp[i] = updater(tmp[i]);
      }
    }
    return tmp;
  }

  private updateListItemData(
    itemId: string,
    itemVersion: number,
    data: ListItemDataProto
  ): Promise<void> {
    return this.updateListItem(itemId, itemVersion, data, null);
  }

  private updateListItemState(
    itemId: string,
    itemVersion: number,
    state: ListItemStateProto
  ): Promise<void> {
    return this.updateListItem(itemId, itemVersion, null, state);
  }

  private updateListItem(
    itemId: string,
    itemVersion: number,
    data: ListItemDataProto | null,
    state: ListItemStateProto | null
  ): Promise<void> {
    return this.props.listModel
      .updateListItem(this.listId, itemId, itemVersion, data, state)
      .then((item: ListItem) => {
        this.setState({
          items: this.makeUpdatedItems(item.getItemId(), () => {
            return item;
          }),
        });
        return Promise.resolve();
      })
      .catch((e) => {
        const error = ConnectError.from(e);
        if (error.code === Code.Unauthenticated) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          errorMessage: error.rawMessage || "Unknown error",
        });
        return Promise.resolve();
      });
  }

  private deleteListItem(itemId: string): Promise<void> {
    return this.props.listModel
      .deleteListItem(this.listId, itemId)
      .then(() => {
        const tmp = this.state.items.slice();
        for (let i = 0; i < tmp.length; ++i) {
          if (tmp[i].getItemId() === itemId) {
            tmp.splice(i, 1);
          }
        }
        this.setState({ items: tmp });
        return Promise.resolve();
      })
      .catch((e) => {
        const error = ConnectError.from(e);
        if (error.code === Code.Unauthenticated) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          errorMessage: error.rawMessage || "Unknown error",
        });
        return Promise.resolve();
      });
  }

  private handleAlertClose() {
    this.setState({ errorMessage: "" });
  }

  private loadData() {
    let loadedList: ListProto | null;
    let listOwnerId: number | undefined;
    let loadedItems: ListItem[];

    this.setState({ loading: true }, () => {
      this.props.listModel
        .getList(this.listId)
        .then((list: ListProto) => {
          loadedList = list;
          return this.props.listModel.listListItems(this.listId);
        })
        .then((items: ListItem[]) => {
          loadedItems = items;

          let users = [];
          const metadata = loadedList!.metadata;
          if (metadata) {
            listOwnerId = metadata.owner;
            if (listOwnerId) {
              users.push(listOwnerId);
            }
          }

          for (const item of items) {
            const claimedBy = item.getClaimedBy();
            if (claimedBy) {
              users.push(claimedBy);
            }
          }

          return this.props.userModel.loadUsers(users);
        })
        .then(() => {
          if (!loadedList || !listOwnerId) return;

          this.setState({
            loading: false,
            list: loadedList,
            listOwner: this.props.userModel.getUser(listOwnerId),
            items: loadedItems,
          });
        })
        .catch((e) => {
          const error = ConnectError.from(e);
          if (error.code === Code.Unauthenticated) {
            this.setState({ loggedIn: false });
            return;
          }

          this.setState({
            loading: false,
            errorMessage: error.rawMessage || "Unknown error",
          });
        });
    });
  }
}

const exportItemList = withRouter(ItemList);

export { exportItemList as ItemList };
