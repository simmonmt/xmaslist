import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import * as React from "react";

const Content = styled(DialogContent)({
  display: "flex",
  alignItems: "center",
  padding: 20, // To match the hard-coded padding-top in DialogContent
});

export function ProgressDialog({
  open,
  label,
}: {
  open: boolean;
  label: string;
}) {
  return (
    <Dialog open={open}>
      <Content>
        <CircularProgress
          // padding interferes with the spinner
          sx={{ marginRight: 2 }}
        />
        <Typography variant="body1" color="textSecondary">
          {label}
        </Typography>
      </Content>
    </Dialog>
  );
}
