package main

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
)

func parseDate(s string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}, err
	}

	return t, nil
}

func parseUserNameOrID(ctx context.Context, db *database.DB, str string) (int, error) {
	owner, err := strconv.Atoi(str)
	if err != nil {
		user, err := db.LookupUserByUsername(ctx, str)
		if err != nil {
			return -1, fmt.Errorf("failed to lookup user %v: %v",
				str, err)
		}
		if user == nil {
			return -1, fmt.Errorf("no such user %v", str)
		}
		owner = user.ID
	}

	return owner, nil
}
