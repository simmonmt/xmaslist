package database

import (
	"database/sql"
	"fmt"
	"net/url"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type asSeconds struct {
	*time.Time
}

func (p asSeconds) Scan(src interface{}) error {
	secs, ok := src.(int64)
	if !ok {
		return fmt.Errorf("src isn't int64")
	}

	*p.Time = time.Unix(secs, 0)
	return nil
}

type DB struct {
	db *sql.DB
}

func OpenInMemory() (*DB, error) {
	args := &url.Values{}
	args.Set("mode", "memory")
	args.Set("cache", "shared")

	return open("/nonexistent", args)
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
