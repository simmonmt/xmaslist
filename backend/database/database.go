package database

import (
	"context"
	"database/sql"
	"net/url"

	"github.com/simmonmt/xmaslist/db/schema"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	db *sql.DB
}

func CreateInMemory(ctx context.Context) (*DB, error) {
	args := &url.Values{}
	args.Set("mode", "memory")
	args.Set("cache", "shared")

	db, err := open("/nonexistent", args)
	if err != nil {
		return nil, err
	}

	if _, err := db.db.ExecContext(ctx, schema.Get()); err != nil {
		return nil, err
	}

	return db, nil
}

func Open(path string) (*DB, error) {
	return open(path, nil)
}

func open(path string, args *url.Values) (*DB, error) {
	if args == nil {
		args = &url.Values{}
	}

	args.Set("_foreign_keys", "true")
	args.Set("_mutex", "full")

	url := url.URL{
		Scheme:   "file",
		Path:     path,
		RawQuery: args.Encode(),
	}
	//log.Printf("DSN = %s\n", url.String())

	db, err := sql.Open("sqlite3", url.String())
	if err != nil {
		return nil, err
	}

	return &DB{
		db: db,
	}, nil
}

func (db *DB) Close() error {
	err := db.db.Close()
	db.db = nil
	return err
}
