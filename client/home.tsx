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
import AddIcon from "@material-ui/icons/Add";
import ArchiveIcon from "@material-ui/icons/Archive";
import UnarchiveIcon from "@material-ui/icons/Unarchive";
import Alert from "@material-ui/lab/Alert";
import { Status, StatusCode } from "grpc-web";
import * as React from "react";
import { Redirect } from "react-router-dom";
import { List as ListProto } from "../proto/list_pb";
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
    };

    this.handleAlertClose = this.handleAlertClose.bind(this);
    this.handleShowArchivedChange = this.handleShowArchivedChange.bind(this);
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
      .then((unused: boolean) => {
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
        >
          <AddIcon />
        </Fab>
      </div>
    );
  }

  private archiveButton(isActive: boolean) {
    const label = isActive ? "archive" : "unarchive";
    const icon = isActive ? <ArchiveIcon /> : <UnarchiveIcon />;

    return (
      <IconButton edge="end" aria-label={label}>
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
      `Owner: ${owner} ` +
      `For: ${data.getBeneficiary()} ` +
      `On: ${eventDate}`;

    return (
      <ListItem key={list.getId()} button>
        <ListItemText primary={data.getName()} secondary={secondary} />
        <ListItemSecondaryAction>
          {this.archiveButton(meta.getActive())}
        </ListItemSecondaryAction>
      </ListItem>
    );
  }

  private handleAlertClose() {
    this.setState({ errorMessage: "" });
  }

  private handleShowArchivedChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ showArchived: evt.target.checked }, this.loadLists);
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
  });

const StyledHome: any = withStyles(homeStyles)(Home);

export { StyledHome as Home };
