import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import TextField from "@material-ui/core/TextField";
import { KeyboardDatePicker } from "@material-ui/pickers";
import * as React from "react";
import { ListData as ListDataProto } from "../proto/list_pb";

interface Props {
  action: string;
  open: boolean;
  onClose: (listData: ListDataProto | null) => void;
  initial: ListDataProto | null;
}

interface State {
  name: string;
  nameErrorMessage: string;
  beneficiary: string;
  beneficiaryErrorMessage: string;
  eventDate: Date | null;
  eventDateErrorMessage: string;
}

export class EditListDialog extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = EditListDialog.stateFromInitial(props.initial);

    this.handleCancel = this.handleCancel.bind(this);
    this.handleOk = this.handleOk.bind(this);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.open !== this.props.open) {
      this.setState(EditListDialog.stateFromInitial(this.props.initial));
    }
  }

  private static stateFromInitial(initial: ListDataProto | null): State {
    let eventDate: Date | null = null;
    if (initial && initial.getEventDate() != 0) {
      eventDate = new Date(initial.getEventDate() * 1000);
    }

    return {
      name: initial ? initial.getName() : "",
      nameErrorMessage: "",
      beneficiary: initial ? initial.getBeneficiary() : "",
      beneficiaryErrorMessage: "",
      eventDate: eventDate,
      eventDateErrorMessage: "",
    };
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
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            this.handleOk();
          }
        }}
      >
        <DialogTitle id="create-dialog-title">
          {this.props.action} List
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            required
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
            required
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
            required
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
            {this.props.action} List
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
