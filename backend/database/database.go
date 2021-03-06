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

	// The go-sqlite3 FAQ says there are problems when you have
	// multiple simultaneous
	// writers.
	// https://github.com/mattn/go-sqlite3#faq
	//
	// From reading the linked issues it sounds like the
	// multiple-write failure modes are hard to reproduce and
	// debug. Much easier to just not allow multiple simultaneous
	// writers by not allowing multiple simultaneous anything.
	//
	// Possible fixes to this:
	//  1. Use a proper non-embedded database, like MySQL/MariaDB
	//  2. Add an rwlock to the database layer.
	//
	// Much much easier to just limit the number of
	// connections. That'll also let me ignore failed transaction
	// commits (I think).
	db.SetMaxOpenConns(1)

	return &DB{
		db: db,
	}, nil
}

func (db *DB) Close() error {
	err := db.db.Close()
	db.db = nil
	return err
}
