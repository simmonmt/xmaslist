import LinearProgress from "@material-ui/core/LinearProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { Status, StatusCode } from "grpc-web";
import * as React from "react";
import { Redirect } from "react-router-dom";
import { List } from "../proto/list_pb";
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
  lists: List[];
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
      (lists: List[]) => {
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
        {this.state.lists.map((list) => (
          <div>{list.getData() && list.getData()!.getName()}</div>
        ))}
      </div>
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
