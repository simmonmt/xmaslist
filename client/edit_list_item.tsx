import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Typography from "@material-ui/core/Typography";
import * as React from "react";
import { ListItemData as ListItemDataProto } from "../proto/list_item_pb";
import { ItemListApiArgs } from "./item_list";

function EditListItem(props: ItemListApiArgs) {
  const { item } = props;
  const data = item.getData() || new ListItemDataProto();

  return (
    <Accordion defaultExpanded={true} expanded={true}>
      <AccordionSummary>
        <Typography variant="h6">{data.getName()}</Typography>
      </AccordionSummary>
      <AccordionDetails>details</AccordionDetails>
    </Accordion>
  );
}

export { EditListItem };
