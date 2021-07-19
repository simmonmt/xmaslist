import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Button from "@material-ui/core/Button";
import Link from "@material-ui/core/Link";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import * as React from "react";
import {
  ListItem as ListItemProto,
  ListItemData as ListItemDataProto,
} from "../proto/list_item_pb";
import { ClaimButton, ClaimedChip } from "./claim";
import { ListItemUpdater } from "./item_list";
import { User } from "./user";

interface Props {
  classes: any;
  showClaim: boolean;
  mutable: boolean;
  item: ListItemProto;
  itemUpdater: ListItemUpdater;
  currentUser: User;
}

interface State {
  updating: boolean;
}

class ItemListElement extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      updating: false,
    };

    this.onClaimClick = this.onClaimClick.bind(this);
  }

  render() {
    const data = this.props.item.getData() || new ListItemDataProto();

    return (
      <Accordion key={"item-" + this.props.item.getId()}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{data.getName()}</Typography>
          <div className={this.props.classes.grow} />
          {this.props.showClaim &&
            this.props.item.getState() &&
            this.props.item.getState()!.getClaimed() && (
              <ClaimedChip
                currentUserId={this.props.currentUser.id}
                item={this.props.item}
              />
            )}
        </AccordionSummary>
        <AccordionDetails className={this.props.classes.details}>
          {data.getDesc() && (
            <div className={this.props.classes.detailSec}>
              <Typography variant="body1">{data.getDesc()}</Typography>
            </div>
          )}
          {data.getDesc() && data.getUrl() && <div />}
          {data.getUrl() && (
            <Typography variant="body1">
              Link: {this.makeLink(data.getUrl())}
            </Typography>
          )}
          <div className={this.props.classes.buttons}>
            {this.props.mutable && [
              <Button variant="contained">Modify</Button>,
              <Button variant="contained">Delete</Button>,
            ]}
            {this.props.showClaim && (
              <ClaimButton
                currentUserId={this.props.currentUser.id}
                item={this.props.item}
                updating={this.state.updating}
                onClaimClick={this.onClaimClick}
                color={this.props.mutable ? "default" : "primary"}
              />
            )}
          </div>
        </AccordionDetails>
      </Accordion>
    );
  }

  private makeLink(urlStr: string) {
    const url = new URL(urlStr);
    const match = url.hostname.match(/^(?:.*\.)?([^.]+)\.[^.]+$/);
    return (
      <Link href={urlStr} target="_blank" rel="noreferrer">
        {match ? match[1] : url.hostname}
      </Link>
    );
  }

  private onClaimClick(newClaimState: boolean) {
    const oldItemState = this.props.item.getState();
    if (!oldItemState) return; // shouldn't happen
    const newItemState = oldItemState.cloneMessage();
    newItemState.setClaimed(newClaimState);

    this.setState({ updating: true });
    return this.props.itemUpdater
      .updateState(
        this.props.item.getId(),
        this.props.item.getVersion(),
        newItemState
      )
      .finally(() => {
        this.setState({ updating: false });
      });
  }
}

const itemListElementStyles = (theme: Theme) =>
  createStyles({
    buttons: {
      display: "flex",
      justifyContent: "flex-end",

      "& > *": { marginLeft: theme.spacing(1) },
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
  });

const exportItemListElement: any = withStyles(itemListElementStyles)(
  ItemListElement
);

export { exportItemListElement as ItemListElement };
