package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type Session struct {
	ID              int
	UserID          int
	Created, Expiry time.Time
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

	session := &Session{
		ID: sessionID,
	}
	err := db.db.QueryRowContext(ctx, query, sessionID).Scan(
		&session.UserID, asSeconds{&session.Created},
		asSeconds{&session.Expiry})
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return nil, nil
	case err != nil:
		return nil, err
	}

	return session, nil
}

func (db *DB) DeleteSession(ctx context.Context, sessionID int) error {
	_, err := db.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`,
		sessionID)
	if err != nil {
		return err
	}

	return nil
}

func (db *DB) DeleteAllSessions(ctx context.Context) error {
	_, err := db.db.ExecContext(ctx, `DELETE FROM sessions`)
	return err
}
