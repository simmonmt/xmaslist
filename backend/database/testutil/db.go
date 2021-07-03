package testutil

import (
	"context"
	"testing"

	"github.com/simmonmt/xmaslist/backend/database"
)

func SetupTestDatabase(ctx context.Context, t *testing.T) *database.DB {
	db, err := database.CreateInMemory(ctx)
	if err != nil {
		t.Fatalf("db create failed: %v", err)
	}
	return db
}
