import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Theme } from '@material-ui/core/styles/createMuiTheme';
import { green } from '@material-ui/core/colors';
import { createStyles, withStyles } from '@material-ui/core/styles';
import * as React from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import Accordion from '@material-ui/core/Accordion';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionActions from '@material-ui/core/AccordionActions';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';

import { ItemModel } from './model';
import { ListItem } from './list_item';

function ClaimedChip(props) {
    if (props.claimed) {
        return <Chip size="small" label="Claimed" />
    } else {
        return <span></span>
    }
}

interface ListItemProps {
    classes: any;
    model: ItemModel;
    id: string;
};

interface ListItemState {
    updating: boolean;
    item: ListItem;
};

class ListItemComponent extends React.Component<ListItemProps, ListItemState> {
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

interface WishListProps {
    classes: any;
};

interface WishListState {
    loading: boolean;
    ids: string[];
};

class WishList extends React.Component<WishListProps, WishListState> {
    private readonly model: ItemModel;

    constructor(props) {
        super(props);

        this.model = new ItemModel();
        this.state = {
            loading: true,
            ids: [],
        }

        // TODO: errors
    }

    componentDidMount() {
	console.log("wish list mounted");
        this.model.loadItems()
            .then((items) => this.itemsLoaded(items));
    }

    private itemsLoaded(itemIds: string[]) {
        const newState: WishListState = {
            loading: false,
            ids: itemIds,
        };

	console.log("ids", itemIds);

        this.setState(newState)
    }

    render() {
        return (
	    <div className={this.props.classes.root}>
                <h1>Wish List</h1>
		{this.state.loading && <LinearProgress />}

                {this.state.ids.map((id) => (
			<ListItemComponent
                            id={id}
                            key={id}
                            model={this.model}
                            classes={this.props.classes} />
		))}
            </div>
        )
    }
}

const styles = (theme: Theme) => createStyles({
    root: {
        width: '100%',
    },
    heading: {
        fontSize: theme.typography.pxToRem(15),
        fontWeight: theme.typography.fontWeightRegular,
    },
    chip: {
        margin: theme.spacing(0.5),
    },
    headingColumn: {
        flexBasis: '100%',
    },
    buttonSuccess: {
        backgroundColor: green[500],
        '&:hover': {
            backgroundColor: green[700],
        },
    },
    buttonProgress: {
        color: green[500],
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -12,
        marginLeft: -12,
    },
});

const StyledWishList = withStyles(styles)(WishList);

export { StyledWishList as WishList };
