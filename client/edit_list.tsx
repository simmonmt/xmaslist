import Card from "@material-ui/core/Card";
import LinearProgress from "@material-ui/core/LinearProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import { format as formatDate } from "date-fns";
import { Error as GrpcError, StatusCode } from "grpc-web";
import * as React from "react";
import { RouteComponentProps } from "react-router";
import { Link as RouterLink, Redirect, withRouter } from "react-router-dom";
import { ListItem as ListItemProto } from "../proto/list_item_pb";
import { List as ListProto } from "../proto/list_pb";
import { ListModel } from "./list_model";
import { User } from "./user";

interface PathParams {
  listId: string;
}

class ListItemUiState {
  readonly item: ListItemProto;

  constructor(item: ListItemProto) {
    this.item = item;
  }
}

class ListItemUiStateBuilder {
  item: ListItemProto;

  constructor(base: ListItemUiState) {
    this.item = base.item;
  }

  build(): ListItemUiState {
    return new ListItemUiState(this.item);
  }
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
  itemUiStates: ListItemUiState[];
}

class EditList extends React.Component<Props, State> {
  private readonly listId: string;

  constructor(props: Props) {
    super(props);
    this.state = {
      loggedIn: true,
      loading: false,
      errorMessage: "",
      list: null,
      itemUiStates: [],
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

        <Card className={this.props.classes.card} raised>
          {this.listItems()}
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

  private listItems() {
    if (this.state.itemUiStates.length == 0) {
      return <div>The list is empty</div>;
    }

    return <div>Feed me</div>;
  }

  private makeUpdatedItemUiStates(
    id: string,
    updater: (stateBuilder: ListItemUiStateBuilder) => void
  ): ListItemUiState[] {
    const tmp = this.state.itemUiStates.slice();
    for (let i = 0; i < tmp.length; ++i) {
      if (tmp[i].item.getId() === id) {
        const b = new ListItemUiStateBuilder(tmp[i]);
        updater(b);
        tmp[i] = b.build();
      }
    }
    return tmp;
  }

  private handleAlertClose() {
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
            itemUiStates: items.map((item) => ({
              item: item,
              updating: false,
            })),
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

const editListStyles = () =>
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
    details: {
      display: "flex",
      flexDirection: "column",
    },
    detailSec: {
      marginBotton: "1ch",
    },
    grow: {
      flexGrow: 1,
    },
    claimButton: {
      display: "flex",
      justifyContent: "flex-end",
    },
  });

const exportEditList: any = withStyles(editListStyles)(withRouter(EditList));

export { exportEditList as EditList };
