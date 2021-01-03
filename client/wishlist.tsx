import { ItemModel } from './model';
import * as React from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';

interface Props {
};

interface State {
    loading: boolean;
    ids: string[];
};

export class WishList extends React.Component<Props, State> {
    private readonly model: ItemModel;

    constructor(props) {
        super(props);

        this.model = new ItemModel();
        this.state = {
            loading: true,
            ids: [],
        }

        this.model.loadItems()
            .then((items) => this.itemsLoaded(items));
        // TODO: errors
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
		//<div className={this.props.classes.root}>
		<div>
                <h1>Wish List</h1>
		{this.state.loading && <LinearProgress />}
		</div>

            // {this.state.ids.map((id) => (
            //         <ListItemComponent
            //     id={id}
            //     key={id}
            //     active={this.state.active === id}
            //     model={this.model}
            //     classes={this.props.classes} />
            // ))}
            // </div>
        )
    }
}
