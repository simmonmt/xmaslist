import Card from "@material-ui/core/Card";
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
import { Theme } from "@material-ui/core/styles/createTheme";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";
import RestoreFromTrashIcon from "@material-ui/icons/RestoreFromTrash";
import Alert from "@material-ui/lab/Alert";
import { format } from "date-fns";
import { Error as GrpcError, StatusCode } from "grpc-web";
import * as React from "react";
import { Link, Redirect } from "react-router-dom";
import { List as ListProto, ListData as ListDataProto } from "../proto/list_pb";
import { CreateListDialog } from "./create_list_dialog";
import { ListModel } from "./list_model";
import { User } from "./user";
import { UserModel } from "./user_model";

interface ListItemLinkProps {
  to: string;
  children: React.ReactNode;
}

function ListItemLink(props: ListItemLinkProps) {
  const { to, children } = props;

  // I'm not entirely sure what this does. Source:
  // https://material-ui.com/guides/composition/#wrapping-components
  //
  // useMemo makes CustomLink a static component -- it only gets re-rendered
  // when 'to' changes. So I guess that means it won't change when just children
  // change? The ref lets link access the anchor created by ListItem. I think.
  const CustomLink = React.useMemo(
    () =>
      React.forwardRef<HTMLAnchorElement>((linkProps, ref) => (
        <Link ref={ref} to={to} {...linkProps} />
      )),
    [to]
  );

  return (
    <ListItem button component={CustomLink}>
      {children}
    </ListItem>
  );
}

interface ListElementProps {
  list: ListProto;
  userModel: UserModel;
  currentUser: User;
  curYear: number;
  onDeleteClicked: (id: string, isActive: boolean) => void;
  classes: any;
}

interface ListElementState {}

class ListElement extends React.Component<ListElementProps, ListElementState> {
  render() {
    const list = this.props.list;
    const listId = list.getId();
    const data = list.getData();
    const meta = list.getMetadata();
    if (!listId || !data || !meta) {
      return <div />;
    }

    let eventDate = new Date(data.getEventDate() * 1000);
    const monthStr = format(eventDate, "MMM");
    const day = eventDate.getDate();
    const year = eventDate.getFullYear();

    const ownerUser = this.props.userModel.getUser(meta.getOwner());
    const owner = ownerUser ? ownerUser.fullname : "unknown";

    const linkVerb =
      this.props.currentUser.id === meta.getOwner() ? "edit" : "view";
    const linkTarget = `/${linkVerb}/${listId}`;

    return (
      <ListItemLink to={linkTarget}>
        <ListItemText>
          <div className={this.props.classes.listItem}>
            <div className={this.props.classes.listDate}>
              <Typography variant="body1" color="textSecondary">
                {this.props.curYear == year ? (
                  <span>
                    {monthStr} {day}
                  </span>
                ) : (
                  <span>
                    {monthStr} {day}
                    <br />
                    {year}
                  </span>
                )}
              </Typography>
            </div>
            <div>
              <div>{data.getName()}</div>
              <div></div>
            </div>
            <div className={this.props.classes.listGrow} />
            <div className={this.props.classes.listMeta}>
              <div>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  component="span"
                >
                  For:
                </Typography>{" "}
                {data.getBeneficiary()}
              </div>
              <div>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  component="span"
                >
                  By:
                </Typography>{" "}
                {owner}
              </div>
            </div>
          </div>
        </ListItemText>
        {this.props.currentUser.isAdmin && (
          <ListItemSecondaryAction>
            {this.deleteButton(list.getId(), meta.getActive())}
          </ListItemSecondaryAction>
        )}
      </ListItemLink>
    );
  }

  private deleteButton(id: string, isActive: boolean) {
    const label = isActive ? "delete" : "undelete";
    const icon = isActive ? <DeleteIcon /> : <RestoreFromTrashIcon />;

    return (
      <IconButton
        edge="end"
        aria-label={label}
        onClick={() => this.props.onDeleteClicked(id, isActive)}
      >
        {icon}
      </IconButton>
    );
  }
}

interface HomeProps {
  listModel: ListModel;
  userModel: UserModel;
  onShouldLogout: () => void;
  currentUser: User;
  classes: any;
}

interface HomeState {
  loading: boolean;
  loggedIn: boolean;
  errorMessage: string;
  lists: ListProto[];
  showDeleted: boolean;
  createDialogOpen: boolean;
  creatingDialogOpen: boolean;
}

class Home extends React.Component<HomeProps, HomeState> {
  private readonly curYear: number;

  constructor(props: HomeProps) {
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
    let gotLists: ListProto[] = [];

    this.setState({ lists: [], errorMessage: "" });

    this.props.listModel
      .listLists(this.state.showDeleted)
      .then((lists: ListProto[]) => {
        let needIds = new Set<number>();
        for (const list of lists) {
          needIds.add(list.getMetadata()!.getOwner());
        }

        gotLists = lists;
        return this.props.userModel.loadUsers(Array.from(needIds.values()));
      })
      .then(() => {
        this.setState({
          loading: false,
          lists: gotLists,
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

        <Card raised>
          <List>{this.makeList(this.state.lists)} </List>
        </Card>

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

  private makeList(lists: ListProto[]) {
    const out = [];
    for (let i = 0; i < lists.length; i++) {
      if (i !== 0) {
        out.push(<Divider key={"div" + i} />);
      }

      const list = lists[i];
      out.push(
        <ListElement
          key={list.getId()}
          list={list}
          userModel={this.props.userModel}
          currentUser={this.props.currentUser}
          curYear={this.curYear}
          onDeleteClicked={this.handleDeleteClicked}
          classes={this.props.classes}
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
      if (this.state.lists[i].getId() === id) {
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
      const newList = toDelete.cloneMessage();
      newList.getMetadata()!.setActive(!isActive);
      tmpLists[idx] = newList;
    }
    this.setState({ lists: tmpLists });

    this.props.listModel.changeActiveState(
      id,
      Number(toDelete.getVersion()),
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
      .catch((error: GrpcError) => {
        if (error.code === StatusCode.UNAUTHENTICATED) {
          this.setState({ loggedIn: false });
          return;
        }

        this.setState({
          creatingDialogOpen: false,
          errorMessage: error.message || "Unknown error",
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
    listDate: {
      textAlign: "center",
      width: "10ch",
    },
    listGrow: {
      flexGrow: 1,
    },
    listItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    listMeta: {
      textAlign: "right",
      marginRight: "3ch",
    },
  });

const StyledHome: any = withStyles(homeStyles)(Home);

export { StyledHome as Home };
