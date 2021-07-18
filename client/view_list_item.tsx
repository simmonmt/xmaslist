import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Link from "@material-ui/core/Link";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import * as React from "react";
import {
  ListItem as ListItemProto,
  ListItemData as ListItemDataProto,
} from "../proto/list_item_pb";
import { ClaimButton, ClaimedChip } from "./claim";
import { ListItemUpdater } from "./item_list";

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
export { ViewListItem };
