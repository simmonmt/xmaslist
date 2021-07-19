import Button, { ButtonProps } from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import * as React from "react";
import { ListItem as ListItemProto } from "../proto/list_item_pb";

export function ClaimedChip({
  currentUserId,
  item,
}: {
  currentUserId: number;
  item: ListItemProto;
}) {
  const metadata = item.getMetadata();
  let label = "Claimed";
  if (metadata && Number(metadata.getClaimedBy()) === currentUserId) {
    label = "Claimed by you";
  }

  return <Chip label={label} />;
}

const useClaimButtonStyles = makeStyles(() =>
  createStyles({
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
  })
);

interface ClaimButtonProps extends ButtonProps {
  currentUserId: number;
  item: ListItemProto;
  updating: boolean;
  onClaimClick: (newState: boolean) => void;
}

export function ClaimButton({
  currentUserId,
  item,
  updating,
  onClaimClick,
  ...rest
}: ClaimButtonProps) {
  const classes = useClaimButtonStyles();
  const state = item.getState();
  const claimed = state && state.getClaimed() === true;

  const metadata = item.getMetadata();
  const currentUserClaimed =
    metadata && metadata.getClaimedBy() === currentUserId;

  const active = !updating && (!claimed || currentUserClaimed);
  const label = claimed ? "Unclaim" : "Claim";

  return (
    <div className={classes.wrapper}>
      <Button
        variant="contained"
        disabled={!active}
        onClick={() => onClaimClick(!claimed)}
        {...rest}
      >
        {label}
      </Button>
      {updating && (
        <CircularProgress size={24} className={classes.buttonProgress} />
      )}
    </div>
  );
}
