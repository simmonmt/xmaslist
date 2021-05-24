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
import { User } from "./user";

interface Props {
  user: User | null;
  classes: any;
}

interface State {
  profileMenuAnchorElement: HTMLElement | null;
}

class Banner extends React.Component<Props, State> {
  private userListenerId = 0;

  constructor(props: Props) {
    super(props);
    this.state = {
      profileMenuAnchorElement: null,
    };
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
    if (this.props.user !== null) {
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
