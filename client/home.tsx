import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import Divider from "@material-ui/core/Divider";
import Fab from "@material-ui/core/Fab";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import IconButton from "@material-ui/core/IconButton";
import LinearProgress from "@material-ui/core/LinearProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";
import RestoreFromTrashIcon from "@material-ui/icons/RestoreFromTrash";
import Alert from "@material-ui/lab/Alert";
import { format, formatDistanceToNow } from "date-fns";
import { Status, StatusCode } from "grpc-web";
import * as React from "react";
import { Redirect } from "react-router-dom";
import { List as ListProto, ListData as ListDataProto } from "../proto/list_pb";
import { CreateListDialog } from "./create_list_dialog";
import { ListModel } from "./list_model";
import { User } from "./user";
import { UserModel } from "./user_model";

interface Props {
  listModel: ListModel;
  userModel: UserModel;
  onShouldLogout: () => void;
  currentUser: User;
  classes: any;
}

interface State {
  loading: boolean;
  loggedIn: boolean;
  errorMessage: string;
  lists: ListProto[];
  showDeleted: boolean;
  createDialogOpen: boolean;
  creatingDialogOpen: boolean;
}

class Home extends React.Component<Props, State> {
  constructor(props: Props) {
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

    this.handleAlertClose = this.handleAlertClose.bind(this);
    this.handleShowDeletedChange = this.handleShowDeletedChange.bind(this);
    this.handleCreateClicked = this.handleCreateClicked.bind(this);
    this.handleCreateDialogClose = this.handleCreateDialogClose.bind(this);
  }

  componentDidMount() {
    this.loadLists();
  }

  private loadLists() {
    let gotLists: ListProto[] = [];

    this.setState({ lists: [], errorMessage: "" });

    this.props.listModel
      .listLists(this.state.showDeleted)
      .then((lists: ListProto[]) => {
        console.log("got lists", lists);
        let needIds = new Set<number>();
        for (const list of lists) {
          needIds.add(list.getMetadata()!.getOwner());
        }

        gotLists = lists;
        console.log("loading users", needIds);
        return this.props.userModel.loadUsers(Array.from(needIds.values()));
      })
      .then(() => {
        console.log("loaded users");
        this.setState({
          loading: false,
          lists: gotLists,
        });
      })
      .catch((status: Status) => {
        if (status.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          loading: false,
          errorMessage: status.details,
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
            {this.state.errorMessage}
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
        <List>{this.state.lists.map((list) => this.listElement(list))}</List>
        <Fab
          color="primary"
          aria-label="create"
          className={this.props.classes.fab}
          onClick={this.handleCreateClicked}
        >
          <AddIcon />
        </Fab>
        <CreateListDialog
          open={this.state.createDialogOpen}
          onClose={this.handleCreateDialogClose}
        />
        <Dialog open={this.state.creatingDialogOpen}>
          <DialogContent>
            <DialogContentText>Creating list</DialogContentText>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  private deleteButton(isActive: boolean, clickHandler: () => void) {
    const label = isActive ? "delete" : "undelete";
    const icon = isActive ? <DeleteIcon /> : <RestoreFromTrashIcon />;

    return (
      <IconButton edge="end" aria-label={label} onClick={clickHandler}>
        {icon}
      </IconButton>
    );
  }

  private listElement(list: ListProto) {
    const data = list.getData();
    const meta = list.getMetadata();
    if (!data || !meta) {
      return;
    }

    let eventDate = new Date(data.getEventDate() * 1000);
    const ownerUser = this.props.userModel.getUser(meta.getOwner());
    const owner = ownerUser ? ownerUser.username : "unknown";

    const handleDeleteClick = () => {
      this.handleDeleteClick(String(list.getId()), Boolean(meta.getActive()));
      return false;
    };

    console.log(formatDistanceToNow);

    return (
      <React.Fragment key={list.getId()}>
        <ListItem button>
          <ListItemText>
            <div className={this.props.classes.listItem}>
              <div>
                <div>{data.getName()}</div>
                <div>
                  <Typography variant="body2" color="textSecondary">
                    Owner: {owner}
                    For: {data.getBeneficiary()}
                  </Typography>
                </div>
              </div>
              <div>
                <div>{format(eventDate, "MMM do, yyyy")}</div>
                <div className={this.props.classes.listDuration}>
                  <Typography variant="body2" color="textSecondary">
                    {formatDistanceToNow(eventDate)}
                  </Typography>
                </div>
              </div>
            </div>
          </ListItemText>
          {this.props.currentUser.isAdmin && (
            <ListItemSecondaryAction>
              {this.deleteButton(meta.getActive(), handleDeleteClick)}
            </ListItemSecondaryAction>
          )}
        </ListItem>
        <Divider />
      </React.Fragment>
    );
  }

  private handleAlertClose() {
    this.setState({ errorMessage: "" });
  }

  private handleShowDeletedChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ showDeleted: evt.target.checked }, this.loadLists);
  }

  private handleDeleteClick(id: string, isActive: boolean) {
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

    const copy = this.state.lists.slice();
    if (isActive && !this.state.showDeleted) {
      copy.splice(idx, 1);
    } else {
      const newList = copy[idx].cloneMessage();
      newList.getMetadata()!.setActive(!isActive);
      copy[idx] = newList;
    }
    this.setState({ lists: copy });

    this.props.listModel.changeActiveState(
      id,
      Number(copy[idx].getVersion()),
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
      .catch((status: Status) => {
        if (status.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          creatingDialogOpen: false,
          errorMessage: status.details,
        });
      });
  }
}

const homeStyles = (theme: Theme) =>
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
    listItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    listDuration: {
      textAlign: "right",
    },
  });

const StyledHome: any = withStyles(homeStyles)(Home);

export { StyledHome as Home };
