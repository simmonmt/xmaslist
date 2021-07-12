import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Link from "@material-ui/core/Link";
import { createStyles, makeStyles, withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import * as React from "react";
import {
  ListItem as ListItemProto,
  ListItemData as ListItemDataProto,
} from "../proto/list_item_pb";
import { ListItemUpdater } from "./view_list";

function ClaimedChip({
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

function ClaimButton({
  currentUserId,
  item,
  updating,
  onClick,
}: {
  currentUserId: number;
  item: ListItemProto;
  updating: boolean;
  onClick: (newState: boolean) => void;
}) {
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
        color="primary"
        disabled={!active}
        onClick={() => onClick(!claimed)}
      >
        {label}
      </Button>
      {updating && (
        <CircularProgress size={24} className={classes.buttonProgress} />
      )}
    </div>
  );
}

function makeLink(urlStr: string) {
  const url = new URL(urlStr);
  const match = url.hostname.match(/^(?:.*\.)?([^.]+)\.[^.]+$/);
  return (
    <Link href={urlStr} target="_blank" rel="noreferrer">
      {match ? match[1] : url.hostname}
    </Link>
  );
}

const useViewListItemStyles = makeStyles(() =>
  createStyles({
    claimButton: {
      display: "flex",
      justifyContent: "flex-end",
    },
    details: {
      display: "flex",
      flexDirection: "column",
    },
    detailSec: {
      marginBotton: "1ch",
    },
    grow: {
      flexGrow: 1,
    },
  })
);

function ViewListItem({
  item,
  currentUserId,
  itemUpdater,
}: {
  item: ListItemProto;
  currentUserId: number;
  itemUpdater: ListItemUpdater;
}) {
  const classes = useViewListItemStyles();
  const [updating, setUpdating] = React.useState(false);

  const claimClickHandler = (newClaimState: boolean) => {
    const oldItemState = item.getState();
    if (!oldItemState) return; // shouldn't happen
    const newItemState = oldItemState.cloneMessage();
    newItemState.setClaimed(newClaimState);

    setUpdating(true);
    return itemUpdater
      .updateState(item.getId(), item.getVersion(), newItemState)
      .finally(() => {
        setUpdating(false);
      });
  };

  const data = item.getData() || new ListItemDataProto();

  return (
    <Accordion key={"item-" + item.getId()}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">{data.getName()}</Typography>
        <div className={classes.grow} />
        {item.getState() && item.getState()!.getClaimed() && (
          <ClaimedChip currentUserId={currentUserId} item={item} />
        )}
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        {data.getDesc() && (
          <div className={classes.detailSec}>
            <Typography variant="body1">{data.getDesc()}</Typography>
          </div>
        )}
        {data.getDesc() && data.getUrl() && <div />}
        {data.getUrl() && (
          <Typography variant="body1">
            Link: {makeLink(data.getUrl())}
          </Typography>
        )}
        <div className={classes.claimButton}>
          <ClaimButton
            currentUserId={currentUserId}
            item={item}
            updating={updating}
            onClick={claimClickHandler}
          />
        </div>
      </AccordionDetails>
    </Accordion>
  );
}

const viewListItemStyles = () =>
  createStyles({
    claimButton: {
      display: "flex",
      justifyContent: "flex-end",
    },
  });

const exportViewListItem: any = withStyles(viewListItemStyles)(ViewListItem);

export { exportViewListItem as ViewListItem };
