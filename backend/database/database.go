package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func hashPassword(pw string) string {
	sum := sha256.Sum256([]byte(pw))
	return fmt.Sprintf("%x", sum)
}

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
	ID                 int
	Username, Fullname string
	Admin              bool
}

type Session struct {
	ID              int
	UserID          int
	Created, Expiry time.Time
}

func (db *DB) CreateTables(ctx context.Context) error {
	queries := map[string]string{"users": `
            CREATE TABLE users (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                username TEXT UNIQUE,
                                fullname TEXT,
                                password TEXT,
                                admin BOOL);
            `, "sessions": `
            CREATE TABLE sessions (id INTEGER NOT NULL PRIMARY KEY
	                              AUTOINCREMENT,
	                           user INTEGER REFERENCES users(id),
	                           created INTEGER,
                                   expiry INTEGER);
            `}

	for name, query := range queries {
		_, err := db.db.ExecContext(ctx, query)
		if err != nil {
			return fmt.Errorf("table create %v failed: %v", name, err)
		}
	}

	return nil
}

func (db *DB) AddUser(ctx context.Context, user *User, password string) (int, error) {
	if user.ID != 0 {
		panic("ID must be 0")
	}

	query := `INSERT INTO users (username, fullname, password, admin)
                         VALUES (?, ?, ?, ?)`
	result, err := db.db.ExecContext(ctx, query, user.Username, user.Fullname,
		hashPassword(password), user.Admin)
	if err != nil {
		return -1, fmt.Errorf("user add failed: %v", err)
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return -1, fmt.Errorf("failed to get user ID")
	}

	return int(userID), nil
}

var (
	invalidUserPassword = fmt.Errorf("invalid user/password")
)

func (db *DB) AuthenticateUser(ctx context.Context, username, password string) (int, error) {
	query := `SELECT id, password FROM users WHERE username = ?`

	var userID int
	var dbPwHash string
	err := db.db.QueryRowContext(ctx, query, username).Scan(&userID, &dbPwHash)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return -1, invalidUserPassword
	case err != nil:
		return -1, err
	}

	if dbPwHash != hashPassword(password) {
		return -1, invalidUserPassword
	}

	return userID, nil
}

func (db *DB) LookupUser(ctx context.Context, userID int) (*User, error) {
	query := `SELECT username, fullname, admin FROM users WHERE id = ?`

	user := &User{ID: userID}
	err := db.db.QueryRowContext(ctx, query, userID).Scan(
		&user.Username, &user.Fullname, &user.Admin)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return nil, nil
	case err != nil:
		return nil, err
	}
	return user, err
}

func (db *DB) CreateSession(ctx context.Context, userID int, created, expiry time.Time) (*Session, error) {
	tx, err := db.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, `DELETE FROM sessions WHERE user = ?`,
		userID)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf(
			"delete existing session failed: %v", err)
	}

	query := `INSERT OR REPLACE INTO sessions(user, created, expiry)
	                 VALUES (?, ?, ?)`
	result, err := tx.ExecContext(ctx, query, userID, created.Unix(),
		expiry.Unix())
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf(
			"create new session failed: %v", err)
	}

	sessionID, err := result.LastInsertId()
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf(
			"get new session ID failed: %v", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf(
			"create new session commit failed: %v", err)
	}

	return &Session{
		ID:      int(sessionID),
		UserID:  userID,
		Created: created,
		Expiry:  expiry,
	}, nil
}

func (db *DB) LookupSession(ctx context.Context, sessionID int) (*Session, error) {
	query := `SELECT user, created, expiry FROM sessions WHERE id = ?`

	var user, created, expiry int64
	err := db.db.QueryRowContext(ctx, query, sessionID).Scan(
		&user, &created, &expiry)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return nil, nil
	case err != nil:
		return nil, err
	}

	return &Session{
		ID:      sessionID,
		UserID:  int(user),
		Created: time.Unix(created, 0),
		Expiry:  time.Unix(expiry, 0),
	}, nil
}

func (db *DB) DeleteSession(ctx context.Context, sessionID int) error {
	_, err := db.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`,
		sessionID)
	if err != nil {
		return err
	}

	return nil
}

func (db *DB) Close() error {
	err := db.db.Close()
	db.db = nil
	return err
}
