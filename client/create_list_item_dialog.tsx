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
  open: boolean;
  onClose: (listData: ListItemDataProto | null) => void;
}

interface State {
  name: string;
  nameErrorMessage: string;
  desc: string;
  descErrorMessage: string;
  url: string | null;
  urlErrorMessage: string;
}

class CreateListItemDialog extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      name: "",
      nameErrorMessage: "",
      desc: "",
      descErrorMessage: "",
      url: "",
      urlErrorMessage: "",
    };

    this.onCancelClicked = this.onCancelClicked.bind(this);
    this.onOkClicked = this.onOkClicked.bind(this);
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
        onClose={this.onCancelClicked}
        aria-labelledby="create-item-dialog-title"
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            this.onOkClicked();
          }
        }}
      >
        <DialogTitle id="create-item-dialog-title">
          Create List Item
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
          <Button onClick={this.onCancelClicked} color="primary">
            Cancel
          </Button>
          <Button onClick={this.onOkClicked} color="primary">
            Create Item
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  private onCancelClicked() {
    this.props.onClose(null);
  }

  private onOkClicked() {
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

const exportCreateListItemDialog: any = withStyles(createListItemDialogStyles)(
  CreateListItemDialog
);

export { exportCreateListItemDialog as CreateListItemDialog };
