import Card from "@material-ui/core/Card";
import grey from "@material-ui/core/colors/grey";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import Fab from "@material-ui/core/Fab";
import LinearProgress from "@material-ui/core/LinearProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import Typography from "@material-ui/core/Typography";
import AddIcon from "@material-ui/icons/Add";
import Alert from "@material-ui/lab/Alert";
import { format as formatDate } from "date-fns";
import { Error as GrpcError, StatusCode } from "grpc-web";
import * as React from "react";
import { RouteComponentProps } from "react-router";
import { Link as RouterLink, Redirect, withRouter } from "react-router-dom";
import {
  ListItem as ListItemProto,
  ListItemData as ListItemDataProto,
  ListItemState as ListItemStateProto,
} from "../proto/list_item_pb";
import { List as ListProto } from "../proto/list_pb";
import { EditListItemDialog } from "./edit_list_item_dialog";
import { ItemListElement } from "./item_list_element";
import { ListModel } from "./list_model";
import { User } from "./user";

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
  currentUser: User;
  mode: ItemListMode;
}

interface State {
  loggedIn: boolean;
  loading: boolean;
  errorMessage: string;
  list: ListProto | null;
  items: ListItemProto[];
  createItemDialogOpen: boolean;
  creatingItemDialogOpen: boolean;
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
      items: [],
      createItemDialogOpen: false,
      creatingItemDialogOpen: false,
    };

    this.listId = this.props.match.params.listId;
    this.itemUpdater = {
      updateData: this.updateListItemData.bind(this),
      updateState: this.updateListItemState.bind(this),
      delete: this.deleteListItem.bind(this),
    };

    this.onCreateClicked = this.onCreateClicked.bind(this);
    this.onCreateItemDialogClose = this.onCreateItemDialogClose.bind(this);
  }

  componentDidMount() {
    this.loadData();
  }

  render() {
    return (
      <div className={this.props.classes.root}>
        {!this.state.loggedIn && <Redirect to="/logout" />}
        {this.state.loading && <LinearProgress />}
        {this.state.errorMessage && (
          <Alert
            severity="error"
            variant="standard"
            onClose={this.onAlertClose}
          >
            Error: {this.state.errorMessage}
          </Alert>
        )}
        <div>
          <Typography variant="body1">
            <RouterLink to="/">&lt;&lt; All lists</RouterLink>
          </Typography>
        </div>

        <Card className={this.props.classes.card} raised>
          {this.listMeta()}
        </Card>

        {this.state.items.length > 0 && (
          <Card className={this.props.classes.card} raised>
            {this.listItems()}
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
              onClick={this.onCreateClicked}
            >
              <AddIcon />
            </Fab>
            <EditListItemDialog
              action="Create"
              open={this.state.createItemDialogOpen}
              onClose={this.onCreateItemDialogClose}
              initial={null}
            />
            <Dialog open={this.state.creatingItemDialogOpen}>
              <DialogContent>
                <DialogContentText>Creating Item</DialogContentText>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    );
  }

  private onCreateClicked() {
    this.setState({ createItemDialogOpen: true });
  }

  private onCreateItemDialogClose(itemData: ListItemDataProto | null) {
    this.setState({ createItemDialogOpen: false });
    if (!itemData) {
      return;
    }

    this.props.listModel
      .createListItem(this.listId, itemData)
      .then((item: ListItemProto) => {
        const copy = this.state.items.slice();
        copy.push(item);

        this.setState({ creatingItemDialogOpen: false, items: copy });
      })
      .catch((error: GrpcError) => {
        if (error.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          creatingItemDialogOpen: false,
          errorMessage: error.message || "Unknown error",
        });
      });
  }

  private listMeta() {
    if (!this.state.list) return;

    const data = this.state.list.getData()!;
    return (
      <div className={this.props.classes.meta}>
        <Typography variant="h2">{data.getName()}</Typography>
        <Typography variant="body1" color="textSecondary">
          {
            // Long localized date
            formatDate(data.getEventDate(), "PPPP")
          }
        </Typography>
      </div>
    );
  }

  private makeItemListItem(item: ListItemProto) {
    return (
      <ItemListElement
        key={item.getId()}
        mode={this.props.mode}
        item={item}
        itemUpdater={this.itemUpdater}
        currentUser={this.props.currentUser}
      />
    );
  }

  private listItems() {
    return (
      <div>{this.state.items.map((item) => this.makeItemListItem(item))}</div>
    );
  }

  private makeUpdatedItems(
    id: string,
    updater: (item: ListItemProto) => ListItemProto
  ): ListItemProto[] {
    const tmp = this.state.items.slice();
    for (let i = 0; i < tmp.length; ++i) {
      if (tmp[i].getId() === id) {
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
      .then((item: ListItemProto) => {
        this.setState({
          items: this.makeUpdatedItems(item.getId(), () => {
            return item;
          }),
        });
        return Promise.resolve();
      })
      .catch((error: GrpcError) => {
        if (error.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          errorMessage: error.message || "Unknown error",
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
          if (tmp[i].getId() === itemId) {
            tmp.splice(i, 1);
          }
        }
        this.setState({ items: tmp });
        return Promise.resolve();
      })
      .catch((error: GrpcError) => {
        if (error.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          errorMessage: error.message || "Unknown error",
        });
        return Promise.resolve();
      });
  }

  private onAlertClose() {
    this.setState({ errorMessage: "" });
  }

  private loadData() {
    this.setState({ loading: true }, () => {
      this.props.listModel
        .getList(this.listId)
        .then((list: ListProto) => {
          this.setState({ list: list });
          return this.props.listModel.listListItems(this.listId);
        })
        .then((items: ListItemProto[]) => {
          this.setState({
            loading: false,
            items: items,
          });
        })
        .catch((error: GrpcError) => {
          if (error.code === StatusCode.UNAUTHENTICATED) {
            this.setState({ loggedIn: false });
            return;
          }

          this.setState({
            loading: false,
            errorMessage: error.message || "Unknown error",
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
  });

const exportItemList: any = withStyles(itemListStyles)(withRouter(ItemList));

export { exportItemList as ItemList };
