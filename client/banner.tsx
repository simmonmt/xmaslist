import AppBar from "@material-ui/core/AppBar";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Toolbar from "@material-ui/core/Toolbar";
import AccountCircle from "@material-ui/icons/AccountCircle";
import * as React from "react";
import { Link } from "react-router-dom";
import { UserModel } from "./user_model";

interface Props {
  userModel: UserModel;
  classes: any;
}

interface State {
  isLoggedIn: boolean;
  fullname: string;

  profileMenuAnchorElement: HTMLElement | null;
}

class Banner extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isLoggedIn: this.props.userModel.isLoggedIn(),
      fullname: this.props.userModel.fullname(),
      profileMenuAnchorElement: null,
    };

    this.props.userModel.registerListener(
      this.handleLoginStateChange.bind(this)
    );
  }

  render() {
    const classes = this.props.classes;

    const profileMenuId = "profile-menu";
    const isProfileMenuOpen = this.state.profileMenuAnchorElement !== null;
    const handleProfileMenuOpen = this.handleProfileMenuOpen.bind(this);
    const renderProfileMenu = (
      <Menu
        anchorEl={this.state.profileMenuAnchorElement}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        id={profileMenuId}
        keepMounted
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={isProfileMenuOpen}
        onClose={() => this.handleProfileMenuClose()}
      >
        <MenuItem
          component={Link}
          to={"/logout"}
          onClick={() => this.handleProfileMenuLogout()}
        >
          Logout
        </MenuItem>
      </Menu>
    );

    let userButtons = <span />;
    if (this.state.isLoggedIn) {
      userButtons = (
        <IconButton
          edge="end"
          onClick={handleProfileMenuOpen}
          aria-controls={profileMenuId}
          aria-haspopup="true"
          color="inherit"
        >
          <AccountCircle />
        </IconButton>
      );
    }

    return (
      <div className={classes.grow}>
        <AppBar position="static">
          <Toolbar>
            <div className={classes.grow} />
            {userButtons}
          </Toolbar>
        </AppBar>
        {renderProfileMenu}
      </div>
    );
  }

  private handleLoginStateChange() {
    if (!this.props.userModel.isLoggedIn()) {
      this.setState({ isLoggedIn: false });
      return;
    }

    this.setState({
      isLoggedIn: true,
      fullname: this.props.userModel.fullname(),
    });
  }

  private handleProfileMenuOpen(event: React.MouseEvent<HTMLElement>) {
    this.setState({ profileMenuAnchorElement: event.currentTarget });
  }

  private handleProfileMenuLogout() {
    return this.handleProfileMenuClose();
  }

  private handleProfileMenuClose() {
    this.setState({ profileMenuAnchorElement: null });
  }
}

const bannerStyles = (theme: Theme) =>
  createStyles({
    grow: {
      flexGrow: 1,
    },
  });

const StyledBanner: any = withStyles(bannerStyles)(Banner);

export { StyledBanner as Banner };
