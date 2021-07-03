package dbutil

import (
	"context"

	"github.com/simmonmt/xmaslist/backend/database"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func GetList(ctx context.Context, db *database.DB, listID int) (*database.List, error) {
	lists, err := db.ListLists(ctx, database.OnlyListWithID(listID))
	if err != nil {
		return nil, err
	}

	if len(lists) == 0 {
		return nil, status.Errorf(codes.NotFound,
			"no list with id %v", listID)
	}

	return lists[0], nil
}
