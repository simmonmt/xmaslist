import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import * as React from "react";
import { Navigate } from "react-router";
import { AuthModel } from "./auth_model";

interface Props {
  authModel: AuthModel;
  onLogout: () => void;
}

const Root = styled("div")({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});

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
      return <Navigate to="/login" replace />;
    }

    return (
      <Root>
        <Typography variant="h2">Signing out...</Typography>
      </Root>
    );
  }

  componentDidMount() {
    this.props.authModel.logout().then(() => {
      this.props.onLogout();
      this.setState({ loggedOut: true });
    });
  }
}

export { Logout };
