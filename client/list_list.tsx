import { clone } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Fab from "@mui/material/Fab";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import { styled } from "@mui/material/styles";
import Switch from "@mui/material/Switch";
import * as React from "react";
import { Navigate } from "react-router";
import { EditListDialog } from "./edit_list_dialog";
import {
  ListData as ListDataProto,
  List as ListProto,
  ListSchema,
} from "./gen/proto/list_pb";
import { ListListElement } from "./list_list_element";
import { ListModel } from "./list_model";
import { ProgressDialog } from "./progress_dialog";
import { User } from "./user";
import { UserModel } from "./user_model";

interface ListListProps {
  listModel: ListModel;
  userModel: UserModel;
  currentUser: User;
}

const CreateFab = styled(Fab)(({ theme }) => ({
  position: "absolute",
  bottom: theme.spacing(2),
  right: theme.spacing(2),
}));

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
          needIds.add(list.metadata!.owner);
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
  }

  render() {
    return (
      <Box sx={{ width: "100%" }}>
        {!this.state.loggedIn && <Navigate to="/logout" replace />}
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
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
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
          </Box>
        )}

        <Card raised>
          <List>{this.makeList(this.state.lists)} </List>
        </Card>

        <CreateFab
          color="primary"
          aria-label="create"
          onClick={this.handleCreateClicked}
        >
          <AddIcon />
        </CreateFab>
        <EditListDialog
          open={this.state.createDialogOpen}
          onClose={this.handleCreateDialogClose}
          action="Create"
          initial={null}
        />
        <ProgressDialog
          open={this.state.creatingDialogOpen}
          label="Creating List"
        />
      </Box>
    );
  }

  private makeList(lists: ListProto[]) {
    const out = [];
    for (let i = 0; i < lists.length; i++) {
      if (i !== 0) {
        out.push(<Divider key={"div" + i} />);
      }

      const list = lists[i];

      const owner = this.props.userModel.getUser(list.metadata!.owner);
      if (!owner) {
        console.log("list", list.id, "has unknown owner; skipping");
        continue;
      }

      out.push(
        <ListListElement
          key={list.id}
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
      if (this.state.lists[i].id === id) {
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
      const newList = clone(ListSchema, toDelete);
      newList.metadata!.active = !isActive;
      tmpLists[idx] = newList;
    }
    this.setState({ lists: tmpLists });

    this.props.listModel.changeActiveState(
      id,
      Number(toDelete.version),
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
      .catch((e) => {
        const error = ConnectError.from(e);
        if (error.code === Code.Unauthenticated) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          creatingDialogOpen: false,
          errorMessage: error.rawMessage || "Unknown error",
        });
      });
  }
}

export { ListList };
