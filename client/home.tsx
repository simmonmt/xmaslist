import Fab from "@material-ui/core/Fab";
import LinearProgress from "@material-ui/core/LinearProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import AddIcon from "@material-ui/icons/Add";
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
}

class Home extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      loggedIn: true,
      errorMessage: "",
      lists: [],
    };
  }

  componentDidMount() {
    let gotLists: ListProto[] = [];

    this.props.listModel
      .listLists(false)
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
        {this.state.errorMessage && <div>{this.state.errorMessage}</div>}
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
      <ListItem button>
        <ListItemText primary={data.getName()} secondary={secondary} />
      </ListItem>
    );
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
  });

const StyledHome: any = withStyles(homeStyles)(Home);

export { StyledHome as Home };
