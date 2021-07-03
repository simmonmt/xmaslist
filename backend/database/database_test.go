package database_test

import (
	"context"
	"testing"

	"github.com/simmonmt/xmaslist/backend/database"
)

var (
	ctx = context.Background()
)

func setupTestDatabase(t *testing.T) *database.DB {
	db, err := database.CreateInMemory(ctx)
	if err != nil {
		t.Fatalf("db create failed: %v", err)
	}
	return db
}
