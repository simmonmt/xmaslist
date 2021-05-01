import Button from "@material-ui/core/Button";
import { createStyles, styled, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import * as React from "react";

interface Props {
  classes: any;
}

interface State {
  error: string;
  username: string;
  password: string;
}

const inputStyles = {
  margin: "5px",
  width: "35ch",
};

const StyledButton = styled(Button)(inputStyles);
const StyledTextField = styled(TextField)(inputStyles);

class Login extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: "",
      username: "",
      password: "",
    };
  }

  handleUsernameChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    this.setState({ username: e.target.value });
  };

  handlePasswordChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    this.setState({ password: e.target.value });
  };

  handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    if (this.state.username.length === 0) {
      this.setState({ error: "Username/email is required" });
      return;
    } else if (this.state.password.length === 0) {
      this.setState({ error: "Password is required" });
      return;
    } else {
      this.setState({ error: "" });
    }
  };

  render() {
    return (
      <form className={this.props.classes.root} onSubmit={this.handleSubmit}>
        <Typography variant="h2">Please sign in</Typography>
        {this.state.error.length > 0 && (
          <Alert severity="error" variant="standard">
            {this.state.error}
          </Alert>
        )}
        <StyledTextField
          id="username"
          label="Username/email"
          variant="standard"
          autoComplete="username"
          value={this.state.username}
          onChange={this.handleUsernameChange}
        />
        <StyledTextField
          id="password"
          label="Password"
          type="password"
          variant="standard"
          autoComplete="current-password"
          value={this.state.password}
          onChange={this.handlePasswordChange}
        />
        <StyledButton variant="contained" color="primary" type="submit">
          Sign in
        </StyledButton>
      </form>
    );
  }
}

const styles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
  });

const StyledLogin: any = withStyles(styles)(Login);

export { StyledLogin as Login };
