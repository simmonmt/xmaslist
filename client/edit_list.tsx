import * as React from "react";
import { withRouter } from "react-router-dom";
import { ItemList, ItemListApiArgs, Props as ItemListProps } from "./item_list";
import { ItemListElement } from "./item_list_element";

interface Props extends ItemListProps {}

interface State {}

class EditList extends React.Component<Props, State> {
  render() {
    return (
      <ItemList {...this.props}>
        {({ key, item, currentUser, itemUpdater }: ItemListApiArgs) => (
          <ItemListElement
            key={key}
            showClaim={false}
            mutable={true}
            item={item}
            itemUpdater={itemUpdater}
            currentUser={currentUser}
          />
        )}
      </ItemList>
    );
  }
}

const exportEditList: any = withRouter(EditList);

export { exportEditList as EditList };
