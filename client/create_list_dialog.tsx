import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import TextField from "@material-ui/core/TextField";
import { KeyboardDatePicker } from "@material-ui/pickers";
import * as React from "react";
import { ListData as ListDataProto } from "../proto/list_pb";

interface Props {
  classes: any;
  open: boolean;
  onClose: (listData: ListDataProto | null) => void;
}

interface State {
  name: string;
  nameErrorMessage: string;
  beneficiary: string;
  beneficiaryErrorMessage: string;
  eventDate: Date | null;
  eventDateErrorMessage: string;
}

class CreateListDialog extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      name: "",
      nameErrorMessage: "",
      beneficiary: "",
      beneficiaryErrorMessage: "",
      eventDate: null,
      eventDateErrorMessage: "",
    };

    this.handleCancel = this.handleCancel.bind(this);
    this.handleOk = this.handleOk.bind(this);
  }

  render() {
    const handleDateChange = (date: Date | null) => {
      this.setState({ eventDate: date });
    };

    const handleNameChange = (name: string) => {
      this.setState({ name: name });
    };

    const handleBeneficiaryChange = (beneficiary: string) => {
      this.setState({ beneficiary: beneficiary });
    };

    return (
      <Dialog
        open={this.props.open}
        onClose={this.handleCancel}
        aria-labelledby="create-dialog-title"
      >
        <DialogTitle id="create-dialog-title">Create List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="List name"
            fullWidth
            value={this.state.name}
            onChange={(event) => handleNameChange(event.target.value)}
            error={this.state.nameErrorMessage.length > 0}
            helperText={this.state.nameErrorMessage}
          />
          <TextField
            margin="dense"
            id="beneficiary"
            label="Who's it for?"
            fullWidth
            value={this.state.beneficiary}
            onChange={(event) => handleBeneficiaryChange(event.target.value)}
            error={this.state.beneficiaryErrorMessage.length > 0}
            helperText={this.state.beneficiaryErrorMessage}
          />
          <KeyboardDatePicker
            value={this.state.eventDate}
            onChange={handleDateChange}
            label="Event date"
            format="MM/dd/yyyy"
            margin="normal"
            error={this.state.eventDateErrorMessage.length > 0}
            helperText={this.state.eventDateErrorMessage}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={this.handleOk} color="primary">
            Create List
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  private handleCancel() {
    this.props.onClose(null);
  }

  private handleOk() {
    let error = false;

    if (this.state.name) {
      this.setState({ nameErrorMessage: "" });
    } else {
      this.setState({
        nameErrorMessage: "This field is required",
      });
      error = true;
    }

    if (this.state.beneficiary) {
      this.setState({ beneficiaryErrorMessage: "" });
    } else {
      this.setState({
        beneficiaryErrorMessage: "This field is required",
      });
      error = true;
    }

    if (this.state.eventDate) {
      this.setState({ eventDateErrorMessage: "" });
    } else {
      this.setState({
        eventDateErrorMessage: "This field is required",
      });
      error = true;
    }

    if (error) {
      return;
    }

    const listData = new ListDataProto();
    listData.setName(this.state.name);
    listData.setBeneficiary(this.state.beneficiary);
    listData.setEventDate(this.state.eventDate!.getTime() / 1000);
    this.props.onClose(listData);
  }
}

const createListDialogStyles = (theme: Theme) => createStyles({});

const StyledCreateListDialog: any = withStyles(createListDialogStyles)(
  CreateListDialog
);

export { StyledCreateListDialog as CreateListDialog };
