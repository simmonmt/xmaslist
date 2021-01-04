import { Theme } from '@material-ui/core/styles/createMuiTheme';
import { createStyles, withStyles } from '@material-ui/core/styles';
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

class ListItemComponent extends React.Component<Props, State> {
    constructor(props) {
        super(props);

        this.state = {
            updating: false,
            item: this.props.model.getItemById(this.props.id),
        }
    }

    handleClaimClick() {
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
		    <div className={this.props.classes.wrapper}>
                        <Button color="primary"
	                        variant="contained"
                                disabled={this.state.updating}
                                onClick={() => this.handleClaimClick()}>
                            {item.claimed ? "Unclaim" : "Claim"}
                        </Button>
                        {this.state.updating &&
                         <CircularProgress
                             size={24}
                             className={this.props.classes.buttonProgress}
                         />}
	            </div>
                </AccordionActions>
            </Accordion>
        );
    }
}

const styles = (theme: Theme) => createStyles({
    chip: {
        margin: theme.spacing(0.5),
    },
    heading: theme.typography.subtitle2,
    headingColumn: {
        flexBasis: '100%',
    },
    buttonProgress: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -12,
        marginLeft: -12,
    },
    wrapper: {
	margin: theme.spacing(1),
	position: 'relative',
    },
});

const StyledListItemComponent = withStyles(styles)(ListItemComponent);

export { StyledListItemComponent as ListItemComponent };
