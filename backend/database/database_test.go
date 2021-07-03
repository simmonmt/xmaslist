package database_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sort"
	"testing"
	"time"

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

func TestAsSeconds(t *testing.T) {
	tm := time.Time{}
	var s sql.Scanner = database.AsSeconds{&tm}
	if err := s.Scan(int64(1000)); err != nil {
		t.Errorf("s.Scan(1000) = %v, want nil", err)
		return
	}

	if got := tm.Unix(); got != 1000 {
		t.Errorf("tm.Unix() = %v, want 1000", tm.Unix())
	}
}

func TestNullSeconds(t *testing.T) {
	ns := &database.NullSeconds{}
	if err := sql.Scanner(ns).Scan(int64(1000)); err != nil {
		t.Errorf("s.Scan(1000) = %v, want nil", err)
		return
	}

	if !ns.Valid || ns.Time.Unix() != 1000 {
		t.Errorf("s.Scan(1000); %v, want %v",
			ns, database.NullSeconds{time.Unix(1000, 0), true})
	}

	if err := sql.Scanner(ns).Scan(nil); err != nil {
		t.Errorf("s.Scan(1000) = %v, want nil", err)
		return
	}

	if ns.Valid {
		t.Errorf("s.Scan(1000); %v, want %v",
			ns, database.NullSeconds{Valid: false})
	}

	if err := sql.Scanner(ns).Scan("bob"); err == nil {
		t.Errorf("s.Scan(1000) = non-nil, got nil")
		return
	}
}

func TestMain(m *testing.M) {
	var err error
	db, err = createTestDatabase()
	if err != nil {
		panic(fmt.Sprintf("failed to create database: %v", err))
	}

	os.Exit(m.Run())
}
