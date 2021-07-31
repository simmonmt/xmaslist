import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import { makeStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import Typography from "@material-ui/core/Typography";
import * as React from "react";

const styles = makeStyles((theme: Theme) => ({
  content: {
    display: "flex",
    alignItems: "center",
    padding: 20, // To match the hard-coded padding-top in DialogContent
  },
  progress: {
    marginRight: theme.spacing(2), // padding interferes with the spinner
  },
}));

export function ProgressDialog({
  open,
  label,
}: {
  open: boolean;
  label: string;
}) {
  const classes = styles();

  return (
    <Dialog open={open}>
      <DialogContent className={classes.content}>
        <CircularProgress className={classes.progress} />
        <Typography variant="body1" color="textSecondary">
          {label}
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
