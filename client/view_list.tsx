import Card from "@material-ui/core/Card";
import LinearProgress from "@material-ui/core/LinearProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import { format as formatDate } from "date-fns";
import { Status, StatusCode } from "grpc-web";
import * as React from "react";
import { RouteComponentProps } from "react-router";
import { Link, Redirect, withRouter } from "react-router-dom";
import { List as ListProto } from "../proto/list_pb";
import { ListModel } from "./list_model";
import { User } from "./user";

interface PathParams {
  listId: string;
}

interface Props extends RouteComponentProps<PathParams> {
  classes: any;
  listModel: ListModel;
  currentUser: User;
}

interface State {
  loggedIn: boolean;
  loading: boolean;
  errorMessage: string;
  list: ListProto | null;
}

class ViewList extends React.Component<Props, State> {
  private readonly listId: string;

  constructor(props: Props) {
    super(props);
    this.state = {
      loggedIn: true,
      loading: false,
      errorMessage: "",
      list: null,
    };

    this.listId = this.props.match.params.listId;
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
            onClose={this.handleAlertClose}
          >
            {this.state.errorMessage}
          </Alert>
        )}
        <div>
          <Typography variant="body1">
            <Link to="/">&lt;&lt; All lists</Link>
          </Typography>
        </div>

        <Card className={this.props.classes.card} raised>
          {this.listMeta()}
        </Card>

        <Card className={this.props.classes.card} raised>
          elements
        </Card>
      </div>
    );
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

  private handleAlertClose() {
    this.setState({ errorMessage: "" });
  }

  private loadData() {
    this.setState({ loading: true }, () => {
      this.props.listModel
        .getList(this.listId)
        .then((list: ListProto) => {
          this.setState({ loading: false, list: list });
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
    });
  }
}

const viewListStyles = () =>
  createStyles({
    root: {
      width: "100%",
    },
    card: {
      margin: "1em",
    },
    meta: {
      textAlign: "center",
    },
  });

const exportViewList: any = withStyles(viewListStyles)(withRouter(ViewList));

export { exportViewList as ViewList };
