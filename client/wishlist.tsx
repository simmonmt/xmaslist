import { Theme } from '@material-ui/core/styles/createMuiTheme';
import { green } from '@material-ui/core/colors';
import { createStyles, withStyles } from '@material-ui/core/styles';
import * as React from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';

import { ItemModel } from './model';
import { ListItemComponent } from './list_item_component';

interface Props {
    classes: any;
};

interface State {
    loading: boolean;
    ids: string[];
};

class WishList extends React.Component<Props, State> {
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
        const newState: State = {
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
    wrapper: {
	margin: theme.spacing(1),
	position: 'relative',
    },
});

const StyledWishList = withStyles(styles)(WishList);

export { StyledWishList as WishList };
