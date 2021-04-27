package database

import (
	"context"
	"fmt"
	"reflect"
	"testing"
)

var (
	ctx = context.Background()
)

func createTestDatabase(ctx context.Context) (*DB, error) {
	db, err := Open(":memory")
	if err != nil {
		return nil, err
	}

	if err = db.CreateTables(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func createTestDatabaseOrDie(ctx context.Context) *DB {
	db, err := createTestDatabase(ctx)
	if err != nil {
		panic(fmt.Sprintf("failed to create database: %v", err))
	}
	return db
}

func TestLookupUser(t *testing.T) {
	db := createTestDatabaseOrDie(ctx)

	user := &User{Login: "a", Name: "User A", Password: "aa", Admin: false}

	if err := db.AddUser(ctx, user); err != nil {
		t.Errorf("AddUser = %v, want nil", err)
		return
	}

	got, err := db.LookupUser(ctx, "a")
	got.ID = user.ID // dynamically assigned by add

	if err != nil || !reflect.DeepEqual(user, got) {
		t.Errorf(`LookupUser(_, "a") = %+v, %v, want %+v, nil`,
			got, err, user)
	}
}
