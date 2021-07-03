package dbutil

import (
	"context"

	"github.com/simmonmt/xmaslist/backend/database"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func GetListItem(ctx context.Context, db *database.DB, listID, itemID int) (*database.ListItem, error) {
	items, err := db.ListListItems(ctx, listID, database.OnlyItemWithID(itemID))
	if err != nil {
		return nil, err
	}

	if len(items) == 0 {
		return nil, status.Errorf(codes.NotFound,
			"no item with id %v in list %v", itemID, listID)
	}

	return items[0], nil
}
