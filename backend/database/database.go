package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	db *sql.DB
}

func Open(path string) (*DB, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	return &DB{
		db: db,
	}, nil
}

type User struct {
	ID       int
	Login    string
	Name     string
	Password string
	Admin    bool
}

func (db *DB) CreateTables(ctx context.Context) error {
	queries := map[string]string{"users": `
            CREATE TABLE users (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                         login TEXT UNIQUE,
                         name TEXT,
                         password TEXT,
                         admin BOOL);
            `, "sessions": `
            CREATE TABLE sessions (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                         user INTEGER REFERENCES users (id),
                         expiry INTEGER,
                         cookie TEXT);
            `}

	for name, query := range queries {
		_, err := db.db.ExecContext(ctx, query)
		if err != nil {
			return fmt.Errorf("table create %v failed: %v", name, err)
		}
	}

	return nil
}

func (db *DB) AddUser(ctx context.Context, user *User) error {
	if user.ID != 0 {
		panic("ID must be 0")
	}

	query := `INSERT INTO users (login, name, password, admin)
                         VALUES (?, ?, ?, ?)`
	_, err := db.db.ExecContext(ctx, query, user.Login, user.Name,
		user.Password, user.Admin)
	if err != nil {
		return fmt.Errorf("user add failed: %v", err)
	}

	return nil
}

func (db *DB) LookupUser(ctx context.Context, login string) (*User, error) {
	query := "SELECT id, login, name, password, admin FROM users " +
		"WHERE login = ?"

	user := &User{}
	err := db.db.QueryRowContext(ctx, query, login).Scan(
		&user.ID, &user.Login, &user.Name, &user.Password, &user.Admin)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return nil, nil
	case err != nil:
		return nil, err
	default:
		return user, err
	}
}

func (db *DB) Close() error {
	err := db.db.Close()
	db.db = nil
	return err
}

func HashPw(pw string) string {
	sum := sha256.Sum256([]byte(pw))
	return fmt.Sprintf("%x", sum)
}
