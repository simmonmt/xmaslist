import LinearProgress from "@material-ui/core/LinearProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Typography from "@material-ui/core/Typography";
import * as React from "react";
import { ListItemComponent } from "./list_item_component";
import { ItemModel } from "./model";

interface Props {
  classes: any;
}

interface State {
  loading: boolean;
  ids: string[];
}

class WishList extends React.Component<Props, State> {
  private readonly model: ItemModel;

  constructor(props) {
    super(props);

    this.model = new ItemModel();
    this.state = {
      loading: true,
      ids: [],
    };
  }

  componentDidMount() {
    this.model.loadItems().then((items) => this.itemsLoaded(items));
    // TODO: errors
  }

  private itemsLoaded(itemIds: string[]) {
    const newState: State = {
      loading: false,
      ids: itemIds,
    };

    this.setState(newState);
  }

  render() {
    return (
      <div className={this.props.classes.root}>
        <Typography variant="h2">Wish List</Typography>
        {this.state.loading && <LinearProgress />}

        {this.state.ids.map((id) => (
          <ListItemComponent id={id} key={id} model={this.model} />
        ))}
      </div>
    );
  }
}

const styles = (theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
    },
  });

const StyledWishList: any = withStyles(styles)(WishList);

export { StyledWishList as WishList };
