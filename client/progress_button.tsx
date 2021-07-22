import Button, { ButtonProps } from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { createStyles, withStyles } from "@material-ui/core/styles";
import * as React from "react";

interface ProgressButtonProps {
  classes: any;
  updating: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

class ProgressButton extends React.Component<
  ProgressButtonProps & ButtonProps
> {
  render() {
    const { classes, updating, disabled, children, ...rest } = this.props;

    return (
      <div className={classes.wrapper}>
        <Button variant="contained" disabled={disabled || updating} {...rest}>
          {children}
        </Button>
        {updating && (
          <CircularProgress size={24} className={classes.buttonProgress} />
        )}
      </div>
    );
  }
}

const progressButtonStyles = createStyles({
  wrapper: {
    position: "relative",
  },
  buttonProgress: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
});

const exportProgressButton: any =
  withStyles(progressButtonStyles)(ProgressButton);

export { exportProgressButton as ProgressButton };
