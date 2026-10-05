import { create } from "@bufbuild/protobuf";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  DateValidationError,
  PickerChangeHandlerContext,
} from "@mui/x-date-pickers/models";
import { format, isValid, startOfDay } from "date-fns";
import * as React from "react";
import { ListData as ListDataProto, ListDataSchema } from "./gen/proto/list_pb";

// The picker's default limits, made explicit so the error messages can name
// them.
const minEventDate = new Date(1900, 0, 1);
const maxEventDate = new Date(2099, 11, 31);
const dateFormat = "MM/dd/yyyy";

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
  // The picker's own validation result for the current value.
  eventDatePickerError: DateValidationError | null;
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
    if (initial && Number(initial.eventDate) != 0) {
      eventDate = new Date(Number(initial.eventDate) * 1000);
    }

    return {
      name: initial ? initial.name : "",
      nameErrorMessage: "",
      beneficiary: initial ? initial.beneficiary : "",
      beneficiaryErrorMessage: "",
      eventDate: eventDate,
      eventDateErrorMessage: "",
      eventDatePickerError: null,
    };
  }

  render() {
    const handleDateChange = (
      date: Date | null,
      context: PickerChangeHandlerContext<DateValidationError>
    ) => {
      // Keep midnight (local time) of the chosen day. The picker otherwise
      // carries over the time of day of the previous value.
      this.setState({
        eventDate: date && isValid(date) ? startOfDay(date) : date,
        // onError reports this too, but only from an effect, which may not
        // have run yet if OK is clicked right after typing.
        eventDatePickerError: context.validationError,
      });
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
          <DatePicker
            value={this.state.eventDate}
            onChange={handleDateChange}
            label="Event date"
            format={dateFormat}
            minDate={minEventDate}
            maxDate={maxEventDate}
            onError={(error) => this.setState({ eventDatePickerError: error })}
            slotProps={{
              textField: {
                required: true,
                variant: "standard",
                margin: "normal",
                error: this.state.eventDateErrorMessage.length > 0,
                helperText: this.state.eventDateErrorMessage,
              },
            }}
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

    const eventDateErrorMessage = this.eventDateErrorMessage();
    this.setState({ eventDateErrorMessage: eventDateErrorMessage });
    if (eventDateErrorMessage) {
      error = true;
    }

    if (error) {
      return;
    }

    const listData = create(ListDataSchema, {
      name: this.state.name,
      beneficiary: this.state.beneficiary,
      // event_date is an int64 (bigint) in whole seconds.
      eventDate: BigInt(Math.floor(this.state.eventDate!.getTime() / 1000)),
    });
    this.props.onClose(listData);
  }

  private eventDateErrorMessage(): string {
    const eventDate = this.state.eventDate;
    if (!eventDate) {
      return "This field is required";
    }

    switch (this.state.eventDatePickerError) {
      case null:
        break;
      case "minDate":
        return "Date must not be before " + format(minEventDate, dateFormat);
      case "maxDate":
        return "Date must not be after " + format(maxEventDate, dateFormat);
      default:
        return "Invalid date";
    }

    if (!isValid(eventDate)) {
      return "Invalid date";
    }
    return "";
  }
}
