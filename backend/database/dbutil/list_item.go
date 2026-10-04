package dbutil

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/simmonmt/xmaslist/backend/database"
)

func GetListItem(ctx context.Context, db *database.DB, listID, itemID int) (*database.ListItem, error) {
	items, err := db.ListListItems(ctx, listID, database.OnlyItemWithID(itemID))
	if err != nil {
		return nil, err
	}

	if len(items) == 0 {
		return nil, connect.NewError(connect.CodeNotFound,
			fmt.Errorf("no item with id %v in list %v", itemID, listID))
	}

	return items[0], nil
}
