import DeleteIcon from "@mui/icons-material/Delete";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import * as React from "react";
import { Link } from "react-router-dom";
import { List as ListProto } from "./gen/proto/list_pb";
import { User } from "./user";

const ListDate = styled("div")({
  textAlign: "center",
  width: "10ch",
});

const ListGrow = styled("div")({
  flexGrow: 1,
});

const ListRow = styled("div")({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});

const ListMeta = styled("div")({
  textAlign: "right",
  marginRight: "3ch",
});

interface ListListElementProps {
  list: ListProto;
  listOwner: User;
  currentUser: User;
  curYear: number;
  onDeleteClicked: (id: string, isActive: boolean) => void;
}

interface ListListElementState {}

export class ListListElement extends React.Component<
  ListListElementProps,
  ListListElementState
> {
  render() {
    const list = this.props.list;
    const listId = list.id;
    const data = list.data;
    const meta = list.metadata;
    if (!listId || !data || !meta) {
      return <div />;
    }

    let eventDate = new Date(Number(data.eventDate) * 1000);
    const monthStr = format(eventDate, "MMM");
    const day = eventDate.getDate();
    const year = eventDate.getFullYear();

    const linkVerb = this.props.currentUser.id === meta.owner ? "edit" : "view";
    const linkTarget = `/${linkVerb}/${listId}`;

    return (
      <ListItem
        disablePadding
        secondaryAction={
          this.props.currentUser.isAdmin &&
          this.deleteButton(list.id, meta.active)
        }
      >
        <ListItemButton component={Link} to={linkTarget}>
          <ListItemText>
            <ListRow>
              <ListDate>
                <Typography variant="body1" color="textSecondary">
                  {this.props.curYear == year ? (
                    <span>
                      {monthStr} {day}
                    </span>
                  ) : (
                    <span>
                      {monthStr} {day}
                      <br />
                      {year}
                    </span>
                  )}
                </Typography>
              </ListDate>
              <div>
                <div>{data.name}</div>
                <div></div>
              </div>
              <ListGrow />
              <ListMeta>
                <div>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    component="span"
                  >
                    For:
                  </Typography>{" "}
                  {data.beneficiary}
                </div>
                <div>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    component="span"
                  >
                    By:
                  </Typography>{" "}
                  {this.props.listOwner.name()}
                </div>
              </ListMeta>
            </ListRow>
          </ListItemText>
        </ListItemButton>
      </ListItem>
    );
  }

  private deleteButton(id: string, isActive: boolean) {
    const label = isActive ? "delete" : "undelete";
    const icon = isActive ? <DeleteIcon /> : <RestoreFromTrashIcon />;

    return (
      <IconButton
        edge="end"
        aria-label={label}
        onClick={() => this.props.onDeleteClicked(id, isActive)}
      >
        {icon}
      </IconButton>
    );
  }
}
