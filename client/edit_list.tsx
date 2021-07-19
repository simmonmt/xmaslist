import Fab from "@material-ui/core/Fab";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import AddIcon from "@material-ui/icons/Add";
import * as React from "react";
import { withRouter } from "react-router-dom";
import { ListItemData as ListItemDataProto } from "../proto/list_item_pb";
import { CreateListItemDialog } from "./create_list_item_dialog";
import { ItemList, ItemListApiArgs, Props as ItemListProps } from "./item_list";
import { ItemListElement } from "./item_list_element";

interface Props extends ItemListProps {
  classes: any;
}

interface State {
  createItemDialogOpen: boolean;
}

class EditList extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      createItemDialogOpen: false,
    };

    this.onCreateClicked = this.onCreateClicked.bind(this);
    this.onCreateItemDialogClose = this.onCreateItemDialogClose.bind(this);
  }

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
        <Fab
          color="primary"
          aria-label="create"
          className={this.props.classes.fab}
          onClick={this.onCreateClicked}
        >
          <AddIcon />
        </Fab>
        <CreateListItemDialog
          open={this.state.createItemDialogOpen}
          onClose={this.onCreateItemDialogClose}
        />
      </React.Fragment>
    );
  }

  private onCreateClicked() {
    this.setState({ createItemDialogOpen: true });
  }

  private onCreateItemDialogClose(itemData: ListItemDataProto | null) {
    this.setState({ createItemDialogOpen: false });
    if (!itemData) {
      return;
    }
  }
}

const editListStyles = (theme: Theme) =>
  createStyles({
    fab: {
      position: "absolute",
      bottom: theme.spacing(2),
      right: theme.spacing(2),
    },
  });

const exportEditList: any = withStyles(editListStyles)(withRouter(EditList));

export { exportEditList as EditList };
