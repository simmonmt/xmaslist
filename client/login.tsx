import { Status, StatusCode } from "grpc-web";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { createStyles, styled, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import * as React from "react";
import { Redirect, useLocation } from "react-router-dom";
import { AuthModel } from "./auth_model";
import { User } from "./user";

interface Props extends WrappedLoginProps {
  classes: any;
  redirect: string;
}

interface State {
  error: string;
  username: string;
  password: string;
  submitting: boolean;
}

const inputStyles = {
  margin: "5px",
  width: "35ch",
};

const StyledTextField = styled(TextField)(inputStyles);

class Login extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: "",
      username: "",
      password: "",
      submitting: false,
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
    }

    this.setState({
      error: "",
      submitting: true,
    });

    this.props.authModel.login(this.state.username, this.state.password).then(
      (user: User) => {
        this.setState({
          submitting: false,
        });
        this.props.onLogin(user);
      },
      (status: Status) => {
        let message = "An error occurred";
        if (status.code === StatusCode.PERMISSION_DENIED) {
          message = "Invalid username/password";
        }
        this.setState({ error: message, submitting: false });
      }
    );
  };

  render() {
    if (this.props.user !== null) {
      return <Redirect to={this.props.redirect} />;
    }

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
          autoFocus={true}
          disabled={this.state.submitting}
          autoComplete="username"
          value={this.state.username}
          onChange={this.handleUsernameChange}
        />
        <StyledTextField
          id="password"
          label="Password"
          type="password"
          variant="standard"
          disabled={this.state.submitting}
          autoComplete="current-password"
          value={this.state.password}
          onChange={this.handlePasswordChange}
        />
        <div className={this.props.classes.buttonWrapper}>
          <Button
            classes={{ root: this.props.classes.button }}
            variant="contained"
            color="primary"
            disabled={this.state.submitting}
            type="submit"
          >
            Sign in
          </Button>
          {this.state.submitting && (
            <CircularProgress
              size={24}
              className={this.props.classes.buttonProgress}
            />
          )}
        </div>
      </form>
    );
  }
}

const loginStyles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
    button: {
      width: "100%",
    },
    buttonWrapper: {
      ...inputStyles,
      position: "relative",
    },
    buttonProgress: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: -12,
      marginLeft: -12,
    },
  });

const StyledLogin: any = withStyles(loginStyles)(Login);

interface WrappedLoginProps extends React.HTMLAttributes<HTMLElement> {
  authModel: AuthModel;
  user: User | null;
  onLogin: (user: User) => void;
}

// withRedirect() causes type errors (somehow Material UI gets around them using
// createStyles, but react-router does not. The alternative is useLocation(),
// which is a Hook, and apparently hooks aren't usable in class components. So
// we make a function component solely to call useLocation then pass that as a
// prop to the class component. I'm sure there's a better way to do this.
function LoginWithRedirect(props: WrappedLoginProps) {
  const params = new URLSearchParams(useLocation().search);
  let redirect = params.get("redirect");
  if (!redirect) {
    redirect = "/";
  }

  return <StyledLogin {...props} redirect={redirect} />;
}

export { LoginWithRedirect as Login };
