import LinearProgress from "@material-ui/core/LinearProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import * as React from "react";
import { RouteComponentProps } from "react-router";
import { Link, Redirect, withRouter } from "react-router-dom";
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
}

class ViewList extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loggedIn: true,
      loading: false,
      errorMessage: "",
    };
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

        <div>
          <Typography variant="body1">
            View list {this.props.match.params.listId}
          </Typography>
        </div>
      </div>
    );
  }

  private handleAlertClose() {
    this.setState({ errorMessage: "" });
  }
}

const viewListStyles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
    },
  });

const exportViewList: any = withStyles(viewListStyles)(withRouter(ViewList));

export { exportViewList as ViewList };
