import * as React from "react";
import { withRouter } from "react-router-dom";
import { ItemList, ItemListApiArgs, Props as ItemListProps } from "./item_list";
import { ViewListItem } from "./view_list_item";

interface Props extends ItemListProps {}

interface State {}

class ViewList extends React.Component<Props, State> {
  render() {
    return (
      <ItemList {...this.props}>
        {({ key, item, currentUserId, itemUpdater }: ItemListApiArgs) => (
          <ViewListItem
            key={key}
            item={item}
            currentUserId={currentUserId}
            itemUpdater={itemUpdater}
          />
        )}
      </ItemList>
    );
  }
}

const exportViewList: any = withRouter(ViewList);

export { exportViewList as ViewList };
