import { ItemModel } from './model';
import * as React from 'react';

class WishListState {
    loading: boolean;
    ids: string[];
};

export class WishList extends React.Component {
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
        const newState: WishListState = {
            loading: false,
            ids: itemIds,
        };

	console.log("ids", itemIds);

        this.setState(newState)
    }

    render() {
        return (
		//<div className={this.props.classes.root}>
                <h1>Wish List</h1>
                //{this.state.loading && <LinearProgress />}

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
