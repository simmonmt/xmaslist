import * as React from "react";
import { withRouter } from "react-router-dom";
import { ItemList, Props as ItemListProps } from "./item_list";

interface Props extends ItemListProps {}

interface State {}

class ViewList extends React.Component<Props, State> {
  render() {
    return <ItemList {...this.props} />;
  }
}

const exportViewList: any = withRouter(ViewList);

export { exportViewList as ViewList };
