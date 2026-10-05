import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import * as React from "react";
import { EditListItemDialog } from "./edit_list_item_dialog";
import { ListItemData as ListItemDataProto } from "./gen/proto/list_item_pb";
import { ListItemUpdater } from "./item_list";
import { ListItem } from "./list_item";
import { ProgressButton } from "./progress_button";
import { User } from "./user";
import { UserModel } from "./user_model";

export type ItemListElementMode = "view" | "edit" | "admin";

const Buttons = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",

  "& > *": { marginLeft: theme.spacing(1) },
}));

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

  return (
    <Chip
      label={"Claimed by " + (name ? name : "...")}
      // Space the chip away from the expand icon, as it was under v4.
      sx={{ marginRight: 1.5 }}
    />
  );
}

interface Props {
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

export class ItemListElement extends React.Component<Props, State> {
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
          <Box sx={{ flexGrow: 1 }} />
          {showClaim && claimedBy && (
            <ClaimChip userId={claimedBy} userModel={this.props.userModel} />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ display: "flex", flexDirection: "column" }}>
          {item.getDesc() && (
            <div>
              <Typography variant="body1">{item.getDesc()}</Typography>
            </div>
          )}
          {item.getDesc() && item.getUrl() && <div />}
          {item.getUrl() && (
            <Typography variant="body1">
              Link: {this.makeLink(item.getUrl())}
            </Typography>
          )}
          <Buttons>
            {showClaim && this.claimButton()}
            {editMode && [
              <ProgressButton
                key="edit"
                disabled={buttonsDisabled}
                updating={this.state.modifying}
                onClick={this.handleModifyClick}
              >
                Edit
              </ProgressButton>,
              <ProgressButton
                key="delete"
                disabled={buttonsDisabled}
                updating={this.state.deleting}
                onClick={this.handleDeleteClick}
              >
                Delete
              </ProgressButton>,
            ]}
          </Buttons>
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
        color={this.props.mode === "edit" ? "inherit" : "primary"}
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
        <Box component="span" sx={{ color: "error.main" }}>
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
    newItemState.claimed = newClaimState;

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
