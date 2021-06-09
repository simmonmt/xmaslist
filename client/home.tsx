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
import ArchiveIcon from "@material-ui/icons/Archive";
import UnarchiveIcon from "@material-ui/icons/Unarchive";
import Alert from "@material-ui/lab/Alert";
import { Status, StatusCode } from "grpc-web";
import * as React from "react";
import { Redirect } from "react-router-dom";
import { List as ListProto, ListData as ListDataProto } from "../proto/list_pb";
import { AddListDialog } from "./add_list_dialog";
import { ListModel } from "./list_model";
import { UserModel } from "./user_model";

interface Props {
  listModel: ListModel;
  userModel: UserModel;
  onShouldLogout: () => void;
  classes: any;
}

interface State {
  loading: boolean;
  loggedIn: boolean;
  errorMessage: string;
  lists: ListProto[];
  showArchived: boolean;
  addDialogOpen: boolean;
  addingDialogOpen: boolean;
}

class Home extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      loggedIn: true,
      errorMessage: "",
      lists: [],
      showArchived: false,
      addDialogOpen: false,
      addingDialogOpen: false,
    };

    this.handleAlertClose = this.handleAlertClose.bind(this);
    this.handleShowArchivedChange = this.handleShowArchivedChange.bind(this);
    this.handleAddClicked = this.handleAddClicked.bind(this);
    this.handleAddDialogClose = this.handleAddDialogClose.bind(this);
  }

  componentDidMount() {
    this.loadLists();
  }

  private loadLists() {
    let gotLists: ListProto[] = [];

    this.setState({ lists: [], errorMessage: "" });

    this.props.listModel
      .listLists(this.state.showArchived)
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
        <div className={this.props.classes.switchDiv}>
          <FormControlLabel
            label="Show archived lists"
            control={
              <Switch
                checked={this.state.showArchived}
                onChange={this.handleShowArchivedChange}
                name="showArchived"
              />
            }
            labelPlacement="start"
          />
        </div>
        <List>{this.state.lists.map((list) => this.listElement(list))}</List>
        <Fab
          color="primary"
          aria-label="add"
          className={this.props.classes.fab}
          onClick={this.handleAddClicked}
        >
          <AddIcon />
        </Fab>
        <AddListDialog
          open={this.state.addDialogOpen}
          onClose={this.handleAddDialogClose}
        />
        <Dialog open={this.state.addingDialogOpen}>
          <DialogContent>
            <DialogContentText>Creating list</DialogContentText>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  private archiveButton(isActive: boolean, clickHandler: () => void) {
    const label = isActive ? "archive" : "unarchive";
    const icon = isActive ? <ArchiveIcon /> : <UnarchiveIcon />;

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

    let eventDate = new Date(data.getEventDate() * 1000).toLocaleDateString(
      undefined,
      { year: "numeric", month: "long", day: "numeric" }
    );

    const ownerUser = this.props.userModel.getUser(meta.getOwner());
    const owner = ownerUser ? ownerUser.username : "unknown";

    let secondary =
      `Owner: ${owner} ` + //
      `For: ${data.getBeneficiary()} `;

    const handleArchiveClick = () => {
      this.handleArchiveClick(String(list.getId()), Boolean(meta.getActive()));
      return false;
    };

    return (
      <React.Fragment key={list.getId()}>
        <ListItem button>
          <ListItemText>
            <div className={this.props.classes.listItem}>
              <div className={this.props.classes.listText}>
                <div>{data.getName()}</div>
                <div>
                  <Typography variant="body2" color="textSecondary">
                    {secondary}
                  </Typography>
                </div>
              </div>
              <div>{eventDate}</div>
            </div>
          </ListItemText>
          <ListItemSecondaryAction>
            {this.archiveButton(meta.getActive(), handleArchiveClick)}
          </ListItemSecondaryAction>
        </ListItem>
        <Divider />
      </React.Fragment>
    );
  }

  private handleAlertClose() {
    this.setState({ errorMessage: "" });
  }

  private handleShowArchivedChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ showArchived: evt.target.checked }, this.loadLists);
  }

  private handleArchiveClick(id: string, isActive: boolean) {
    let idx = -1;
    for (let i = 0; i < this.state.lists.length; ++i) {
      if (this.state.lists[i].getId() === id) {
        idx = i;
        break;
      }
    }

    if (idx < 0) {
      console.log("archive click on unknown list", id);
      return;
    }

    const copy = this.state.lists.slice();
    if (isActive && !this.state.showArchived) {
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

  private handleAddClicked() {
    this.setState({ addDialogOpen: true });
  }

  private handleAddDialogClose(listData: ListDataProto | null) {
    this.setState({ addDialogOpen: false });
    if (!listData) {
      return;
    }

    this.setState({ addingDialogOpen: true });
    this.props.listModel
      .createList(listData)
      .then((list: ListProto) => {
        const copy = this.state.lists.slice();
        copy.push(list);

        this.setState({ addingDialogOpen: false, lists: copy });
      })
      .catch((status: Status) => {
        if (status.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          addingDialogOpen: false,
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
  });

const StyledHome: any = withStyles(homeStyles)(Home);

export { StyledHome as Home };
