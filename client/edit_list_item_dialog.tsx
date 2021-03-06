import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { createStyles, withStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import * as React from "react";
import { ListItemData as ListItemDataProto } from "../proto/list_item_pb";

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

interface Props {
  classes: any;
  action: string;
  open: boolean;
  onClose: (listData: ListItemDataProto | null) => void;
  initial: ListItemDataProto | null;
}

interface State {
  name: string;
  nameErrorMessage: string;
  desc: string;
  descErrorMessage: string;
  url: string | null;
  urlErrorMessage: string;
}

class EditListItemDialog extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = EditListItemDialog.stateFromInitial(props.initial);

    this.handleCancelClick = this.handleCancelClick.bind(this);
    this.handleOkClick = this.handleOkClick.bind(this);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.open !== this.props.open) {
      this.setState(EditListItemDialog.stateFromInitial(this.props.initial));
    }
  }

  private static stateFromInitial(initial: ListItemDataProto | null): State {
    return {
      name: initial ? initial.getName() : "",
      nameErrorMessage: "",
      desc: initial ? initial.getDesc() : "",
      descErrorMessage: "",
      url: initial ? initial.getUrl() : "",
      urlErrorMessage: "",
    };
  }

  render() {
    const onNameChange = (name: string) => {
      this.setState({ name: name });
    };

    const onDescChange = (desc: string) => {
      this.setState({ desc: desc });
    };

    const onUrlChange = (url: string) => {
      this.setState({ url: url });
    };

    return (
      <Dialog
        open={this.props.open}
        keepMounted={false}
        onClose={this.handleCancelClick}
        aria-labelledby="create-item-dialog-title"
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            this.handleOkClick();
          }
        }}
      >
        <DialogTitle id="create-item-dialog-title">
          {this.props.action} List Item
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            required
            margin="dense"
            id="name"
            label="Item name"
            fullWidth
            value={this.state.name}
            onChange={(event) => onNameChange(event.target.value)}
            error={this.state.nameErrorMessage.length > 0}
            helperText={this.state.nameErrorMessage}
          />
          <TextField
            margin="dense"
            id="desc"
            label="Description"
            fullWidth
            value={this.state.desc}
            onChange={(event) => onDescChange(event.target.value)}
            error={this.state.descErrorMessage.length > 0}
            helperText={this.state.descErrorMessage}
          />
          <TextField
            margin="dense"
            id="url"
            label="URL"
            fullWidth
            value={this.state.url}
            onChange={(event) => onUrlChange(event.target.value)}
            error={this.state.urlErrorMessage.length > 0}
            helperText={this.state.urlErrorMessage}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleCancelClick} color="primary">
            Cancel
          </Button>
          <Button onClick={this.handleOkClick} color="primary">
            {this.props.action} Item
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  private handleCancelClick() {
    this.props.onClose(null);
  }

  private handleOkClick() {
    let error = false;

    if (this.state.name) {
      this.setState({ nameErrorMessage: "" });
    } else {
      this.setState({
        nameErrorMessage: "This field is required",
      });
      error = true;
    }

    if (this.state.url) {
      if (isValidUrl(this.state.url)) {
        this.setState({ urlErrorMessage: "" });
      } else {
        this.setState({ urlErrorMessage: "Not a valid URL" });
        error = true;
      }
    }

    if (error) {
      return;
    }

    const itemData = new ListItemDataProto();
    itemData.setName(this.state.name);
    if (this.state.desc) {
      itemData.setDesc(this.state.desc);
    }
    if (this.state.url) {
      itemData.setUrl(this.state.url);
    }
    this.props.onClose(itemData);
  }
}

const createListItemDialogStyles = () => createStyles({});

const exportEditListItemDialog: any = withStyles(createListItemDialogStyles)(
  EditListItemDialog
);

export { exportEditListItemDialog as EditListItemDialog };
