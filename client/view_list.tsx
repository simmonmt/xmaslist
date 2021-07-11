import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import LinearProgress from "@material-ui/core/LinearProgress";
import Link from "@material-ui/core/Link";
import { createStyles, makeStyles, withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
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

function ClaimedChip({
  currentUserId,
  item,
}: {
  currentUserId: number;
  item: ListItemProto;
}) {
  const metadata = item.getMetadata();
  let label = "Claimed";
  if (metadata && Number(metadata.getClaimedBy()) === currentUserId) {
    label = "Claimed by you";
  }

  return <Chip label={label} />;
}

const useClaimButtonStyles = makeStyles(() =>
  createStyles({
    wrapper: {
      position: "relative",
    },
    buttonProgress: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: -12,
      marginLeft: -12,
    },
  })
);

function ClaimButton({
  currentUserId,
  item,
  updating,
  onClick,
}: {
  currentUserId: number;
  item: ListItemProto;
  updating: boolean;
  onClick: (newState: boolean) => void;
}) {
  const classes = useClaimButtonStyles();
  const state = item.getState();
  const claimed = state && state.getClaimed() === true;

  const metadata = item.getMetadata();
  const currentUserClaimed =
    metadata && metadata.getClaimedBy() === currentUserId;

  const active = !updating && (!claimed || currentUserClaimed);
  const label = claimed ? "Unclaim" : "Claim";

  return (
    <div className={classes.wrapper}>
      <Button
        variant="contained"
        color="primary"
        disabled={!active}
        onClick={() => onClick(!claimed)}
      >
        {label}
      </Button>
      {updating && (
        <CircularProgress size={24} className={classes.buttonProgress} />
      )}
    </div>
  );
}

function makeLink(urlStr: string) {
  const url = new URL(urlStr);
  const match = url.hostname.match(/^(?:.*\.)?([^.]+)\.[^.]+$/);
  return (
    <Link href={urlStr} target="_blank" rel="noreferrer">
      {match ? match[1] : url.hostname}
    </Link>
  );
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

function ViewListItem({
  classes,
  item,
  currentUserId,
  onClaimClick,
}: {
  classes: any;
  item: ListItemProto;
  currentUserId: number;
  onClaimClick: (item: ListItemProto, newState: boolean) => Promise<void>;
}) {
  const [updating, setUpdating] = React.useState(false);

  const data = item.getData();
  if (!data) return <div />;

  const claimClickHandler = (newState: boolean) => {
    setUpdating(true);
    return onClaimClick(item, newState).finally(() => {
      setUpdating(false);
    });
  };

  return (
    <Accordion key={"item-" + item.getId()}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">{data.getName()}</Typography>
        <div className={classes.grow} />
        {item.getState() && item.getState()!.getClaimed() && (
          <ClaimedChip currentUserId={currentUserId} item={item} />
        )}
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        {data.getDesc() && (
          <div className={classes.detailSec}>
            <Typography variant="body1">{data.getDesc()}</Typography>
          </div>
        )}
        {data.getDesc() && data.getUrl() && <div />}
        {data.getUrl() && (
          <Typography variant="body1">
            Link: {makeLink(data.getUrl())}
          </Typography>
        )}
        <div className={classes.claimButton}>
          <ClaimButton
            currentUserId={currentUserId}
            item={item}
            updating={updating}
            onClick={claimClickHandler}
          />
        </div>
      </AccordionDetails>
    </Accordion>
  );
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

class ViewList extends React.Component<Props, State> {
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

    this.claimClicked = this.claimClicked.bind(this);
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

  private makeViewListItem(itemState: ListItemUiState) {
    return (
      <ViewListItem
        key={itemState.item.getId()}
        classes={this.props.classes}
        item={itemState.item}
        currentUserId={this.props.currentUser.id}
        onClaimClick={this.claimClicked}
      />
    );
  }

  private listItems() {
    if (this.state.itemUiStates.length == 0) {
      return <div>The list is empty</div>;
    }

    return (
      <div>
        {this.state.itemUiStates.map((itemState) =>
          this.makeViewListItem(itemState)
        )}
      </div>
    );
  }

  private makeUpdatedItemUiStates(
    id: string,
    updater: (builder: ListItemUiStateBuilder) => void
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

  private claimClicked(
    item: ListItemProto,
    newClaimState: boolean
  ): Promise<void> {
    if (!this.state.list) return Promise.resolve(); // shouldn't happen

    const oldItemState = item.getState();
    if (!oldItemState) return Promise.resolve(); // shouldn't happen
    const newItemState = oldItemState.cloneMessage();
    newItemState.setClaimed(newClaimState);

    return this.props.listModel
      .updateListItemState(
        this.listId,
        item.getId(),
        item.getVersion(),
        newItemState
      )
      .then((item: ListItemProto) => {
        this.setState({
          itemUiStates: this.makeUpdatedItemUiStates(
            item.getId(),
            (builder) => {
              builder.item = item;
            }
          ),
        });
        return Promise.resolve();
      })
      .catch((error: GrpcError) => {
        if (error.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          errorMessage: error.message || "Unknown error",
        });
        return Promise.resolve();
      });
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

const exportViewList: any = withStyles(viewListStyles)(withRouter(ViewList));

export { exportViewList as ViewList };
