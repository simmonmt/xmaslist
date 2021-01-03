import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import Accordion from '@material-ui/core/Accordion';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionActions from '@material-ui/core/AccordionActions';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import * as React from 'react';

import { ItemModel } from './model';
import { ListItem } from './list_item';

function ClaimedChip(props) {
    if (props.claimed) {
        return <Chip size="small" label="Claimed" />
    } else {
        return <span></span>
    }
}

interface Props {
    classes: any;
    model: ItemModel;
    id: string;
};

interface State {
    updating: boolean;
    item: ListItem;
};

export class ListItemComponent extends React.Component<Props, State> {
    constructor(props) {
        super(props);

        this.state = {
            updating: false,
            item: this.props.model.getItemById(this.props.id),
        }
    }

    handleClaimClick = () => {
        this.setState({updating: true});

        const item = this.state.item;
        this.props.model.setClaimState(item.id, !item.claimed)
            .then((updatedItem) => {
                this.setState({
                    updating: false,
                    item: updatedItem,
                });
            });
    }

    render() {
        const item = this.state.item;
        const classes = this.props.classes;

	console.log('rendering', this.props, this.state);

        return (
            <Accordion>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls={`panel${item.id}-content`}
                    id={`panel${item.id}-header`}
                >
                    <div className={classes.headingColumn}>
                        <Typography
                            className={classes.heading}>
                            {item.name}
                        </Typography>
                    </div>
                    <div>
                        <ClaimedChip claimed={item.claimed} />
                    </div>
                </AccordionSummary>
                <AccordionDetails>
                    <Typography>
                        {item.description}
                    </Typography>
                </AccordionDetails>
                <Divider />
                <AccordionActions>
                    <Button color="primary"
                            disabled={this.state.updating}
                            onClick={this.handleClaimClick}>
                        {item.claimed ? "Unclaim" : "Claim"}
                    </Button>
                    {this.state.updating &&
                     <CircularProgress
                         size={24}
                         className={this.props.classes.buttonProgress}
                     />}
                </AccordionActions>
            </Accordion>
        );
    }
}
