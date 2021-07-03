package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type User struct {
	ID                 int
	Username, Fullname string
	Admin              bool
}

func (u *User) String() string {
	return fmt.Sprintf("{%v/%v/%v/%v}", u.ID, u.Username, u.Fullname, u.Admin)
}

type UsersByID []*User

func (a UsersByID) Len() int           { return len(a) }
func (a UsersByID) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a UsersByID) Less(i, j int) bool { return a[i].ID < a[j].ID }

func hashPassword(pw string) string {
	sum := sha256.Sum256([]byte(pw))
	return fmt.Sprintf("%x", sum)
}

func (db *DB) CreateUser(ctx context.Context, user *User, password string) (int, error) {
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
	invalidUserPassword = status.Errorf(codes.PermissionDenied,
		"invalid user/password")
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

func (db *DB) LookupUserByID(ctx context.Context, userID int) (*User, error) {
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

func (db *DB) LookupUserByUsername(ctx context.Context, username string) (*User, error) {
	query := `SELECT id, fullname, admin FROM users WHERE username = ?`

	user := &User{Username: username}
	err := db.db.QueryRowContext(ctx, query, username).Scan(
		&user.ID, &user.Fullname, &user.Admin)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return nil, nil
	case err != nil:
		return nil, err
	}
	return user, err
}

func (db *DB) ListUsers(ctx context.Context) ([]*User, error) {
	query := `SELECT id, username, fullname, admin FROM users`

	users := []*User{}
	rows, err := db.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		user := &User{}
		if err := rows.Scan(&user.ID, &user.Username, &user.Fullname, &user.Admin); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}
