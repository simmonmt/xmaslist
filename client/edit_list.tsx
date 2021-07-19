import { createStyles, withStyles } from "@material-ui/core/styles";
import * as React from "react";
import { withRouter } from "react-router-dom";
import { ItemList, ItemListApiArgs, Props as ItemListProps } from "./item_list";
import { ItemListElement } from "./item_list_element";

interface Props extends ItemListProps {
  classes: any;
}

interface State {}

class EditList extends React.Component<Props, State> {
  render() {
    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }
}

const editListStyles = () => createStyles({});

const exportEditList: any = withStyles(editListStyles)(withRouter(EditList));

export { exportEditList as EditList };
