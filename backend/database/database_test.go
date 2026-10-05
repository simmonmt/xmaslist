package database_test

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/db/schema"
)

var (
	ctx = context.Background()
)

// createDatabaseFile creates a database file at path with the schema.
func createDatabaseFile(t *testing.T, path string) {
	t.Helper()

	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, schema.Get()); err != nil {
		t.Fatal(err)
	}
}

func TestOpen(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	if err := os.Mkdir("sub", 0755); err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{
		"rel.sqlite",
		"sub/rel.sqlite",
		"./dot.sqlite",
		filepath.Join(dir, "abs.sqlite"),
	} {
		t.Run(path, func(t *testing.T) {
			createDatabaseFile(t, path)

			db, err := database.Open(path)
			if err != nil {
				t.Fatalf("Open(%q) = %v", path, err)
			}
			defer db.Close()

			user := &database.User{Username: "a", Fullname: "A"}
			if _, err := db.CreateUser(ctx, user, "pw"); err != nil {
				t.Fatalf("CreateUser in %q: %v", path, err)
			}

			got, err := db.LookupUserByUsername(ctx, "a")
			if err != nil || got == nil {
				t.Fatalf("LookupUserByUsername in %q = %v, %v, want user",
					path, got, err)
			}
		})
	}
}
