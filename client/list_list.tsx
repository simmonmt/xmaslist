import Card from "@material-ui/core/Card";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import Divider from "@material-ui/core/Divider";
import Fab from "@material-ui/core/Fab";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import LinearProgress from "@material-ui/core/LinearProgress";
import List from "@material-ui/core/List";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import Switch from "@material-ui/core/Switch";
import AddIcon from "@material-ui/icons/Add";
import Alert from "@material-ui/lab/Alert";
import { Error as GrpcError, StatusCode } from "grpc-web";
import * as React from "react";
import { Redirect } from "react-router-dom";
import { List as ListProto, ListData as ListDataProto } from "../proto/list_pb";
import { EditListDialog } from "./edit_list_dialog";
import { ListListElement } from "./list_list_element";
import { ListModel } from "./list_model";
import { User } from "./user";
import { UserModel } from "./user_model";

interface ListListProps {
  listModel: ListModel;
  userModel: UserModel;
  onShouldLogout: () => void;
  currentUser: User;
  classes: any;
}

interface ListListState {
  loading: boolean;
  loggedIn: boolean;
  errorMessage: string;
  lists: ListProto[];
  showDeleted: boolean;
  createDialogOpen: boolean;
  creatingDialogOpen: boolean;
}

class ListList extends React.Component<ListListProps, ListListState> {
  private readonly curYear: number;

  constructor(props: ListListProps) {
    super(props);
    this.state = {
      loading: true,
      loggedIn: true,
      errorMessage: "",
      lists: [],
      showDeleted: false,
      createDialogOpen: false,
      creatingDialogOpen: false,
    };

    this.curYear = new Date().getFullYear();

    this.handleAlertClose = this.handleAlertClose.bind(this);
    this.handleShowDeletedChange = this.handleShowDeletedChange.bind(this);
    this.handleDeleteClicked = this.handleDeleteClicked.bind(this);
    this.handleCreateClicked = this.handleCreateClicked.bind(this);
    this.handleCreateDialogClose = this.handleCreateDialogClose.bind(this);
  }

  componentDidMount() {
    this.loadLists();
  }

  private loadLists() {
    this.setState({ lists: [], errorMessage: "" });

    let loadedLists: ListProto[] = [];
    this.props.listModel
      .listLists(this.state.showDeleted)
      .then((lists: ListProto[]) => {
        let needIds = new Set<number>();
        for (const list of lists) {
          needIds.add(list.getMetadata()!.getOwner());
        }

        loadedLists = lists;
        return this.props.userModel.loadUsers(Array.from(needIds.values()));
      })
      .then(() => {
        this.setState({
          loading: false,
          lists: loadedLists,
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
            onClose={this.handleAlertClose}
          >
            Error: {this.state.errorMessage}
          </Alert>
        )}
        {this.props.currentUser.isAdmin && (
          <div className={this.props.classes.switchDiv}>
            <FormControlLabel
              label="Show deleted lists"
              control={
                <Switch
                  checked={this.state.showDeleted}
                  onChange={this.handleShowDeletedChange}
                  name="showDeleted"
                />
              }
              labelPlacement="start"
            />
          </div>
        )}

        <Card raised>
          <List>{this.makeList(this.state.lists)} </List>
        </Card>

        <Fab
          color="primary"
          aria-label="create"
          className={this.props.classes.fab}
          onClick={this.handleCreateClicked}
        >
          <AddIcon />
        </Fab>
        <EditListDialog
          open={this.state.createDialogOpen}
          onClose={this.handleCreateDialogClose}
          action="Create"
          initial={null}
        />
        <Dialog open={this.state.creatingDialogOpen}>
          <DialogContent>
            <DialogContentText>Creating list</DialogContentText>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  private makeList(lists: ListProto[]) {
    const out = [];
    for (let i = 0; i < lists.length; i++) {
      if (i !== 0) {
        out.push(<Divider key={"div" + i} />);
      }

      const list = lists[i];

      const owner = this.props.userModel.getUser(
        list.getMetadata()!.getOwner()
      );
      if (!owner) {
        console.log("list", list.getId(), "has unknown owner; skipping");
        continue;
      }

      out.push(
        <ListListElement
          key={list.getId()}
          list={list}
          listOwner={owner}
          currentUser={this.props.currentUser}
          curYear={this.curYear}
          onDeleteClicked={this.handleDeleteClicked}
        />
      );
    }
    return out;
  }

  private handleAlertClose() {
    this.setState({ errorMessage: "" });
  }

  private handleShowDeletedChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ showDeleted: evt.target.checked }, this.loadLists);
  }

  private handleDeleteClicked(id: string, isActive: boolean) {
    let idx = -1;
    for (let i = 0; i < this.state.lists.length; ++i) {
      if (this.state.lists[i].getId() === id) {
        idx = i;
        break;
      }
    }

    if (idx < 0) {
      console.log("delete click on unknown list", id);
      return;
    }

    const toDelete = this.state.lists[idx];

    const tmpLists = this.state.lists.slice();
    if (isActive && !this.state.showDeleted) {
      tmpLists.splice(idx, 1);
    } else {
      const newList = toDelete.cloneMessage();
      newList.getMetadata()!.setActive(!isActive);
      tmpLists[idx] = newList;
    }
    this.setState({ lists: tmpLists });

    this.props.listModel.changeActiveState(
      id,
      Number(toDelete.getVersion()),
      !isActive
    );
  }

  private handleCreateClicked() {
    this.setState({ createDialogOpen: true });
  }

  private handleCreateDialogClose(listData: ListDataProto | null) {
    this.setState({ createDialogOpen: false });
    if (!listData) {
      return;
    }

    this.setState({ creatingDialogOpen: true });
    this.props.listModel
      .createList(listData)
      .then((list: ListProto) => {
        const copy = this.state.lists.slice();
        copy.push(list);

        this.setState({ creatingDialogOpen: false, lists: copy });
      })
      .catch((error: GrpcError) => {
        if (error.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          creatingDialogOpen: false,
          errorMessage: error.message || "Unknown error",
        });
      });
  }
}

const listListStyles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
    },
    fab: {
      position: "absolute",
      bottom: theme.spacing(2),
      right: theme.spacing(2),
    },
    switchDiv: {
      display: "flex",
      justifyContent: "flex-end",
    },
  });

const exportListList: any = withStyles(listListStyles)(ListList);

export { exportListList as ListList };
