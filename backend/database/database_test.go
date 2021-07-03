package database_test

import (
	"context"
	"fmt"
	"os"
	"sort"
	"testing"

	"github.com/simmonmt/xmaslist/backend/database"
)

var (
	ctx = context.Background()

	users = []*database.User{
		&database.User{Username: "a", Fullname: "User A", Admin: false},
		&database.User{Username: "b", Fullname: "User B", Admin: false},
	}
	usersByUsername = map[string]int{}

	passwords = map[string]string{
		"a": "aa",
		"b": "bb",
	}

	db *database.DB
)

func createTestDatabase() (db *database.DB, err error) {
	db, err = database.CreateInMemory(ctx)
	if err != nil {
		return nil, err
	}

	for _, user := range users {
		password := passwords[user.Username]
		var userID int
		userID, err = db.CreateUser(ctx, user, password)
		if err != nil {
			panic(fmt.Sprintf("CreateUser(_, %v, %v) = _, %v, want _, nil", user, password, err))
			return
		}

		user.ID = userID
		usersByUsername[user.Username] = userID
	}

	sort.Sort(database.UsersByID(users))

	return db, nil
}

func TestMain(m *testing.M) {
	var err error
	db, err = createTestDatabase()
	if err != nil {
		panic(fmt.Sprintf("failed to create database: %v", err))
	}

	os.Exit(m.Run())
}
