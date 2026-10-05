import AccountCircle from "@mui/icons-material/AccountCircle";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { TreeIcon } from "./tree_icon";
import { User } from "./user";

interface Props {
  user: User | null;
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
          <Typography variant="body1">
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
      <div>
        <AppBar position="static">
          <Toolbar>
            <Link
              component={RouterLink}
              color="inherit"
              variant="h4"
              underline="none"
              to="/"
            >
              <TreeIcon />
              xmaslist
            </Link>
            <Box sx={{ flexGrow: 1 }} />
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

export { Banner };
