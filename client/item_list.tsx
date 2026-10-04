import { Code, ConnectError } from "@connectrpc/connect";
import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import grey from "@material-ui/core/colors/grey";
import Fab from "@material-ui/core/Fab";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormGroup from "@material-ui/core/FormGroup";
import LinearProgress from "@material-ui/core/LinearProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import AddIcon from "@material-ui/icons/Add";
import Alert from "@material-ui/lab/Alert";
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
  classes: any;
  listModel: ListModel;
  userModel: UserModel;
  currentUser: User;
  mode: ItemListMode;
}

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
      <div className={this.props.classes.root}>
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
        <Box display="flex" justifyContent="space-between">
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

        <Card className={this.props.classes.card} raised>
          {this.listMeta()}
        </Card>

        {this.state.items.length > 0 && (
          <Card className={this.props.classes.card} raised>
            {this.listItems(elementMode)}
          </Card>
        )}

        {this.state.items.length === 0 && !this.state.loading && (
          <div className={this.props.classes.emptyList}>
            <Typography variant="h1" className={this.props.classes.emptyEmoji}>
              ( •́ω•̩̥̀ )
            </Typography>
            <Typography variant="h4">This list is empty</Typography>
          </div>
        )}

        {this.props.mode == "edit" && (
          <div>
            <Fab
              color="primary"
              aria-label="create"
              className={this.props.classes.fab}
              onClick={this.handleCreateClick}
            >
              <AddIcon />
            </Fab>
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
      </div>
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
      <div className={this.props.classes.meta}>
        <Typography variant="h2">{data.name}</Typography>
        <Typography variant="body1">
          {
            // Long localized date
            formatDate(new Date(Number(data.eventDate) * 1000), "PPPP")
          }
        </Typography>
        <div>
          <span className={this.props.classes.metaFor}>
            <Typography variant="body1" component="span" color="textSecondary">
              For:
            </Typography>{" "}
            <Typography variant="body1" component="span">
              {data.beneficiary}
            </Typography>
          </span>
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
          <div className={this.props.classes.buttons}>
            <ProgressButton
              updating={this.state.modifyingList}
              onClick={this.handleModifyListClick}
            >
              Edit
            </ProgressButton>
          </div>
        )}
      </div>
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

const itemListStyles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
    },
    card: {
      margin: "1em",
    },
    meta: {
      textAlign: "center",
    },
    metaFor: {
      marginRight: theme.spacing(2),
    },
    fab: {
      position: "absolute",
      bottom: theme.spacing(2),
      right: theme.spacing(2),
    },
    emptyList: {
      color: grey[400],
      flexGrow: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",

      "& > *": { textAlign: "center" },
    },
    emptyEmoji: {
      fontFamily: "Arial",
      marginBottom: "1rem",
    },
    buttons: {
      display: "flex",
      justifyContent: "flex-end",
    },
  });

const exportItemList: any = withStyles(itemListStyles)(withRouter(ItemList));

export { exportItemList as ItemList };
