import * as React from "react";
import { withRouter } from "react-router-dom";
import { EditListItem } from "./edit_list_item";
import { ItemList, ItemListApiArgs, Props as ItemListProps } from "./item_list";

interface Props extends ItemListProps {}

interface State {}

class EditList extends React.Component<Props, State> {
  render() {
    return (
      <ItemList {...this.props}>
        {({ key, item, currentUserId, itemUpdater }: ItemListApiArgs) => (
          <EditListItem
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

const exportEditList: any = withRouter(EditList);

export { exportEditList as EditList };
