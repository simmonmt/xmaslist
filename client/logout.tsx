import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import * as React from "react";
import { Redirect } from "react-router-dom";
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
      return <Redirect to="/login" />;
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
