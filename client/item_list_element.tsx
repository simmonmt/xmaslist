import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Box from "@material-ui/core/Box";
import Link from "@material-ui/core/Link";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import * as React from "react";
import {
  ListItem as ListItemProto,
  ListItemData as ListItemDataProto,
  ListItemMetadata as ListItemMetadataProto,
  ListItemState as ListItemStateProto,
} from "../proto/list_item_pb";
import { ClaimedChip } from "./claim";
import { EditListItemDialog } from "./edit_list_item_dialog";
import { ListItemUpdater } from "./item_list";
import { ProgressButton } from "./progress_button";
import { User } from "./user";

export type ItemListElementMode = "view" | "edit" | "admin";

interface Props {
  classes: any;
  mode: ItemListElementMode;
  item: ListItemProto;
  itemUpdater: ListItemUpdater;
  currentUser: User;
}

interface State {
  claiming: boolean;
  deleting: boolean;
  modifyItemDialogOpen: boolean;
  modifying: boolean;
}

class ItemListElement extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      claiming: false,
      deleting: false,
      modifyItemDialogOpen: false,
      modifying: false,
    };

    this.handleClaimClick = this.handleClaimClick.bind(this);
    this.handleDeleteClick = this.handleDeleteClick.bind(this);
    this.handleModifyClick = this.handleModifyClick.bind(this);
    this.handleModifyItemDialogClose =
      this.handleModifyItemDialogClose.bind(this);
  }

  render() {
    const data = this.props.item.getData() || new ListItemDataProto();

    const buttonsDisabled =
      this.state.claiming || this.state.deleting || this.state.modifying;

    const editMode = this.props.mode === "edit" || this.props.mode == "admin";
    const showClaim = this.props.mode === "view" || this.props.mode === "admin";

    return (
      <Accordion key={"item-" + this.props.item.getId()}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{data.getName()}</Typography>
          <div className={this.props.classes.grow} />
          {showClaim &&
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
            {showClaim && this.claimButton()}
            {editMode && [
              <ProgressButton
                disabled={buttonsDisabled}
                updating={this.state.modifying}
                onClick={this.handleModifyClick}
              >
                Edit
              </ProgressButton>,
              <ProgressButton
                disabled={buttonsDisabled}
                updating={this.state.deleting}
                onClick={this.handleDeleteClick}
              >
                Delete
              </ProgressButton>,
            ]}
          </div>
        </AccordionDetails>
        <EditListItemDialog
          action="Modify"
          open={this.state.modifyItemDialogOpen}
          onClose={this.handleModifyItemDialogClose}
          initial={data}
        />
      </Accordion>
    );
  }

  private claimButton() {
    // Admin mode:
    //   claim/unclaim, always usable
    // View mode:
    //   claim if unclaimed
    //   unclaim if claimed by you else disabled
    const state = this.props.item.getState() || new ListItemStateProto();
    const metadata =
      this.props.item.getMetadata() || new ListItemMetadataProto();
    const claimed: boolean = state && state.getClaimed() === true;
    const claimedByMe: boolean =
      claimed &&
      metadata &&
      metadata.getClaimedBy() === this.props.currentUser.id;

    const claimButtonLabel = claimed ? "Unclaim" : "Claim";

    let claimButtonEnabled = true;
    if (this.props.mode === "view") {
      if (claimed) {
        claimButtonEnabled = claimedByMe;
      }
    }

    return (
      <ProgressButton
        updating={this.state.claiming}
        disabled={!claimButtonEnabled}
        color={this.props.mode === "edit" ? "default" : "primary"}
        onClick={() => this.handleClaimClick(!claimed)}
      >
        {claimButtonLabel}
      </ProgressButton>
    );
  }

  private makeLink(urlStr: string) {
    let url;
    try {
      url = new URL(urlStr);
    } catch (error) {
      return (
        <Box component="span" color="error.main">
          {urlStr}
        </Box>
      );
    }

    const match = url.hostname.match(/^(?:.*\.)?([^.]+)\.[^.]+$/);
    return (
      <Link href={urlStr} target="_blank" rel="noreferrer">
        {match ? match[1] : url.hostname}
      </Link>
    );
  }

  private handleClaimClick(newClaimState: boolean) {
    const oldItemState = this.props.item.getState();
    if (!oldItemState) return; // shouldn't happen
    const newItemState = oldItemState.cloneMessage();
    newItemState.setClaimed(newClaimState);

    this.setState({ claiming: true });
    this.props.itemUpdater
      .updateState(
        this.props.item.getId(),
        this.props.item.getVersion(),
        newItemState
      )
      .finally(() => this.setState({ claiming: false }));
  }

  private handleModifyClick() {
    this.setState({ modifyItemDialogOpen: true });
  }

  private handleModifyItemDialogClose(data: ListItemDataProto | null) {
    this.setState({ modifyItemDialogOpen: false, modifying: data !== null });
    if (!data) {
      return;
    }

    this.props.itemUpdater
      .updateData(this.props.item.getId(), this.props.item.getVersion(), data)
      .finally(() => this.setState({ modifying: false }));
  }

  private handleDeleteClick() {
    this.setState({ deleting: true });
    this.props.itemUpdater.delete(this.props.item.getId());
    // No need to set deleting to false -- this component will be unmounted by
    // the time the promise returned by delete() resolves.
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
