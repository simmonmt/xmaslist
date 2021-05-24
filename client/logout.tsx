import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Typography from "@material-ui/core/Typography";
import * as React from "react";
import { Redirect } from "react-router-dom";
import { UserModel } from "./auth_model";

interface Props {
  userModel: UserModel;
  onLogout: () => void;
  classes: any;
}

interface State {
  loggedOut: boolean;
}

class Logout extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loggedOut: false,
    };
  }

  render() {
    if (this.state.loggedOut) {
      return <Redirect to="/login" />;
    }

    return (
      <div className={this.props.classes.root}>
        <Typography variant="h2">Signing out...</Typography>
      </div>
    );
  }

  componentDidMount() {
    this.props.userModel.logout().then(() => {
      this.props.onLogout();
      this.setState({ loggedOut: true });
    });
  }
}

const logoutStyles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
  });

const StyledLogout: any = withStyles(logoutStyles)(Logout);

export { StyledLogout as Logout };
