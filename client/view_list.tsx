import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import * as React from "react";
import { RouteComponentProps } from "react-router";
import { withRouter } from "react-router-dom";
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

interface State {}

class ViewList extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};

    console.log("viewlist constructor");
  }

  render() {
    console.log("view list render");
    return <div>{this.props.match.params.listId}</div>;
  }
}

const viewListStyles = (theme: Theme) => createStyles({});

const exportViewList: any = withRouter(withStyles(viewListStyles)(ViewList));

export { exportViewList as ViewList };
