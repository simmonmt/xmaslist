import { ButtonProps } from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import * as React from "react";
import { ListItem as ListItemProto } from "../proto/list_item_pb";
import { SelfUpdatingProgressButton } from "./progress_button";

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

interface ClaimButtonProps extends ButtonProps {
  currentUserId: number;
  item: ListItemProto;
  onClaimClick: (newState: boolean) => Promise<void>;
}

export function ClaimButton({
  currentUserId,
  item,
  onClaimClick,
  ...rest
}: ClaimButtonProps) {
  const state = item.getState();
  const claimed = state && state.getClaimed() === true;

  const metadata = item.getMetadata();
  const currentUserClaimed =
    metadata && metadata.getClaimedBy() === currentUserId;

  const active = !claimed || currentUserClaimed;
  const label = claimed ? "Unclaim" : "Claim";

  return (
    <SelfUpdatingProgressButton
      disabled={!active}
      onButtonClick={() => onClaimClick(!claimed)}
      {...rest}
    >
      {label}
    </SelfUpdatingProgressButton>
  );
}
