import AppBar from "@material-ui/core/AppBar";
import IconButton from "@material-ui/core/IconButton";
import Link from "@material-ui/core/Link";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { createStyles, withStyles } from "@material-ui/core/styles";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import AccountCircle from "@material-ui/icons/AccountCircle";
import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { TreeIcon } from "./tree_icon";
import { User } from "./user";

interface Props {
  user: User | null;
  classes: any;
}

interface State {
  profileMenuAnchorElement: HTMLElement | null;
}

class Banner extends React.Component<Props, State> {
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
          component={RouterLink}
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
        <React.Fragment>
          <Typography variant="body1" className={this.props.classes.username}>
            {this.props.user.fullname
              ? this.props.user.fullname
              : this.props.user.username}
          </Typography>
          <IconButton
            edge="end"
            onClick={handleProfileMenuOpen}
            aria-controls={profileMenuId}
            aria-haspopup="true"
            color="inherit"
          >
            <AccountCircle />
          </IconButton>
        </React.Fragment>
      );
    }

    return (
      <div className={classes.grow}>
        <AppBar position="static">
          <Toolbar>
            <span>
              <TreeIcon />
              <Link
                component={RouterLink}
                color="inherit"
                variant="h4"
                underline="none"
                to="/"
              >
                xmaslist
              </Link>
            </span>
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

const bannerStyles = () =>
  createStyles({
    grow: {
      flexGrow: 1,
    },
  });

const StyledBanner: any = withStyles(bannerStyles)(Banner);

export { StyledBanner as Banner };
