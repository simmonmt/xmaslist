package database

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"net/url"
	"time"

	"github.com/simmonmt/xmaslist/db/schema"

	_ "github.com/mattn/go-sqlite3"
)

type AsSeconds struct {
	*time.Time
}

func (p AsSeconds) Scan(src interface{}) error {
	secs, ok := src.(int64)
	if !ok {
		return fmt.Errorf("src isn't int64")
	}

	*p.Time = time.Unix(secs, 0)
	return nil
}

type NullSeconds struct {
	Time  time.Time
	Valid bool
}

func (p *NullSeconds) Scan(src interface{}) error {
	if src == nil {
		p.Valid = false
		return nil
	}

	secs, ok := src.(int64)
	if !ok {
		return fmt.Errorf("src isn't int64")
	}

	p.Time, p.Valid = time.Unix(secs, 0), true
	return nil
}

func (p NullSeconds) Value() (driver.Value, error) {
	if !p.Valid {
		return nil, nil
	}
	return p.Time, nil
}

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
