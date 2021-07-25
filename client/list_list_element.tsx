import IconButton from "@material-ui/core/IconButton";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import { createStyles, withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import DeleteIcon from "@material-ui/icons/Delete";
import RestoreFromTrashIcon from "@material-ui/icons/RestoreFromTrash";
import { format } from "date-fns";
import * as React from "react";
import { Link } from "react-router-dom";
import { List as ListProto } from "../proto/list_pb";
import { User } from "./user";

interface ListItemLinkProps {
  to: string;
  children: React.ReactNode;
}

function ListItemLink(props: ListItemLinkProps) {
  const { to, children } = props;

  // I'm not entirely sure what this does. Source:
  // https://material-ui.com/guides/composition/#wrapping-components
  //
  // useMemo makes CustomLink a static component -- it only gets re-rendered
  // when 'to' changes. So I guess that means it won't change when just children
  // change? The ref lets link access the anchor created by ListItem. I think.
  const CustomLink = React.useMemo(
    () =>
      React.forwardRef<HTMLAnchorElement>((linkProps, ref) => (
        <Link ref={ref} to={to} {...linkProps} />
      )),
    [to]
  );

  return (
    <ListItem button component={CustomLink}>
      {children}
    </ListItem>
  );
}

interface ListListElementProps {
  classes: any;
  list: ListProto;
  listOwner: User;
  currentUser: User;
  curYear: number;
  onDeleteClicked: (id: string, isActive: boolean) => void;
}

interface ListListElementState {}

class ListListElement extends React.Component<
  ListListElementProps,
  ListListElementState
> {
  render() {
    const list = this.props.list;
    const listId = list.getId();
    const data = list.getData();
    const meta = list.getMetadata();
    if (!listId || !data || !meta) {
      return <div />;
    }

    let eventDate = new Date(data.getEventDate() * 1000);
    const monthStr = format(eventDate, "MMM");
    const day = eventDate.getDate();
    const year = eventDate.getFullYear();

    const owner =
      this.props.listOwner.fullname || this.props.listOwner.username;

    const linkVerb =
      this.props.currentUser.id === meta.getOwner() ? "edit" : "view";
    const linkTarget = `/${linkVerb}/${listId}`;

    return (
      <ListItemLink to={linkTarget}>
        <ListItemText>
          <div className={this.props.classes.listItem}>
            <div className={this.props.classes.listDate}>
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
            </div>
            <div>
              <div>{data.getName()}</div>
              <div></div>
            </div>
            <div className={this.props.classes.listGrow} />
            <div className={this.props.classes.listMeta}>
              <div>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  component="span"
                >
                  For:
                </Typography>{" "}
                {data.getBeneficiary()}
              </div>
              <div>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  component="span"
                >
                  By:
                </Typography>{" "}
                {owner}
              </div>
            </div>
          </div>
        </ListItemText>
        {this.props.currentUser.isAdmin && (
          <ListItemSecondaryAction>
            {this.deleteButton(list.getId(), meta.getActive())}
          </ListItemSecondaryAction>
        )}
      </ListItemLink>
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

const listListElementStyles = () =>
  createStyles({
    listDate: {
      textAlign: "center",
      width: "10ch",
    },
    listGrow: {
      flexGrow: 1,
    },
    listItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    listMeta: {
      textAlign: "right",
      marginRight: "3ch",
    },
  });

const exportListListElement: any = withStyles(listListElementStyles)(
  ListListElement
);

export { exportListListElement as ListListElement };
