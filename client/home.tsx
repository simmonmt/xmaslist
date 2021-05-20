import LinearProgress from "@material-ui/core/LinearProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { Status, StatusCode } from "grpc-web";
import * as React from "react";
import { Redirect } from "react-router-dom";
import { List as ListProto } from "../proto/list_pb";
import { ListModel } from "./list_model";

interface Props {
  listModel: ListModel;
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
    this.props.listModel.listLists(false).then(
      (lists: ListProto[]) => {
        this.setState({
          loading: false,
          lists: lists,
        });
      },
      (status: Status) => {
        if (status.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          loading: false,
          errorMessage: status.details,
        });
      }
    );
  }

  render() {
    return (
      <div className={this.props.classes.root}>
        {!this.state.loggedIn && <Redirect to="/logout" />}
        {this.state.loading && <LinearProgress />}
        {this.state.errorMessage && <div>{this.state.errorMessage}</div>}
        <List>{this.state.lists.map((list) => this.listElement(list))}</List>
      </div>
    );
  }

  private listElement(list: ListProto) {
    const data = list.getData();
    if (!data) {
      return;
    }

    let eventDate = new Date(data.getEventDate() * 1000).toLocaleDateString(
      undefined,
      { year: "numeric", month: "long", day: "numeric" }
    );

    return (
      <ListItem button>
        <ListItemText primary={data.getName()} secondary={eventDate} />
      </ListItem>
    );
  }
}

const homeStyles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
    },
  });

const StyledHome: any = withStyles(homeStyles)(Home);

export { StyledHome as Home };
