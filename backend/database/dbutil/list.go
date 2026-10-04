package dbutil

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/simmonmt/xmaslist/backend/database"
)

func GetList(ctx context.Context, db *database.DB, listID int) (*database.List, error) {
	lists, err := db.ListLists(ctx, database.OnlyListWithID(listID))
	if err != nil {
		return nil, err
	}

	if len(lists) == 0 {
		return nil, connect.NewError(connect.CodeNotFound,
			fmt.Errorf("no list with id %v", listID))
	}

	return lists[0], nil
}
