import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Link from "@material-ui/core/Link";
import { createStyles, withStyles } from "@material-ui/core/styles";
import { Theme } from "@material-ui/core/styles/createTheme";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import * as React from "react";
import { ListItemData as ListItemDataProto } from "../proto/list_item_pb";
import { EditListItemDialog } from "./edit_list_item_dialog";
import { ListItemUpdater } from "./item_list";
import { ListItem } from "./list_item";
import { ProgressButton } from "./progress_button";
import { User } from "./user";
import { UserModel } from "./user_model";

export type ItemListElementMode = "view" | "edit" | "admin";

function ClaimChip({
  userId,
  userModel,
}: {
  userId: number;
  userModel: UserModel;
}) {
  const [name, setName] = React.useState("");
  userModel
    .getUserAsync(userId)
    .then((user) => {
      if (user) {
        setName(user.fullname ? user.fullname : user.username);
      } else {
        setName("UNKNOWN");
      }
    })
    .catch(() => {
      setName("ERROR");
    });

  return <Chip label={"Claimed by " + (name ? name : "...")} />;
}

interface Props {
  classes: any;
  mode: ItemListElementMode;
  item: ListItem;
  itemUpdater: ListItemUpdater;
  currentUser: User;
  userModel: UserModel;
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
    const buttonsDisabled =
      this.state.claiming || this.state.deleting || this.state.modifying;

    const editMode = this.props.mode === "edit" || this.props.mode == "admin";
    const showClaim = this.props.mode === "view" || this.props.mode === "admin";

    const item = this.props.item;
    const claimedBy = item.getClaimedBy();

    return (
      <Accordion key={"item-" + item.getItemId()}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{item.getName()}</Typography>
          <div className={this.props.classes.grow} />
          {showClaim && claimedBy && (
            <ClaimChip userId={claimedBy} userModel={this.props.userModel} />
          )}
        </AccordionSummary>
        <AccordionDetails className={this.props.classes.details}>
          {item.getDesc() && (
            <div className={this.props.classes.detailSec}>
              <Typography variant="body1">{item.getDesc()}</Typography>
            </div>
          )}
          {item.getDesc() && item.getUrl() && <div />}
          {item.getUrl() && (
            <Typography variant="body1">
              Link: {this.makeLink(item.getUrl())}
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
          initial={item.getData()}
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
    const claimedBy = this.props.item.getClaimedBy();
    const claimButtonLabel = claimedBy ? "Unclaim" : "Claim";

    // Enable the claim button unless we're in view mode and the claimant is
    // someone other than the current user. This way Bob can't unclaim an item
    // that Sue has already claimed (unless we're in admin mode, in which case
    // all bets are off). We don't have a special case here for edit mode
    // because the claim button isn't displayed in edit mode.
    let claimButtonEnabled = true;
    if (this.props.mode === "view") {
      if (claimedBy) {
        claimButtonEnabled = claimedBy === this.props.currentUser.id;
      }
    }

    return (
      <ProgressButton
        updating={this.state.claiming}
        disabled={!claimButtonEnabled}
        color={this.props.mode === "edit" ? "default" : "primary"}
        onClick={() => this.handleClaimClick(!this.props.item.isClaimed())}
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
    const newItemState = this.props.item.getState();
    newItemState.setClaimed(newClaimState);

    this.setState({ claiming: true });
    this.props.itemUpdater
      .updateState(
        this.props.item.getItemId(),
        this.props.item.getItemVersion(),
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
      .updateData(
        this.props.item.getItemId(),
        this.props.item.getItemVersion(),
        data
      )
      .finally(() => this.setState({ modifying: false }));
  }

  private handleDeleteClick() {
    this.setState({ deleting: true });
    this.props.itemUpdater.delete(this.props.item.getItemId());
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
