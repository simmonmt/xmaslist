package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	_ "github.com/mattn/go-sqlite3"
)

type User struct {
	ID                 int
	Username, Fullname string
	Admin              bool
}

type UsersByID []*User

func (a UsersByID) Len() int           { return len(a) }
func (a UsersByID) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a UsersByID) Less(i, j int) bool { return a[i].ID < a[j].ID }

type ListsByID []*List

func (a ListsByID) Len() int           { return len(a) }
func (a ListsByID) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a ListsByID) Less(i, j int) bool { return a[i].ID < a[j].ID }

type Session struct {
	ID              int
	UserID          int
	Created, Expiry time.Time
}

type ListData struct {
	Name        string
	Beneficiary string
	EventDate   time.Time
	Active      bool
}

type List struct {
	ListData

	ID      int
	Version int
	OwnerID int
	Created time.Time
	Updated time.Time
}

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

func (db *DB) Close() error {
	err := db.db.Close()
	db.db = nil
	return err
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

func (db *DB) CreateList(ctx context.Context, ownerID int, listData *ListData, now time.Time) (*List, error) {
	list := &List{
		ListData: *listData,
		Version:  0,
		OwnerID:  ownerID,
		Created:  now,
		Updated:  now,
	}

	query := `INSERT INTO lists (version, owner, name, beneficiary,
                                     event_date, created, updated,
                                     active)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := db.db.ExecContext(ctx, query,
		list.Version, list.OwnerID, list.Name,
		list.Beneficiary, list.EventDate.Unix(),
		list.Created.Unix(), list.Updated.Unix(), list.Active)
	if err != nil {
		return nil, fmt.Errorf("list create failed: %v", err)
	}

	listID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get list ID")
	}

	list.ID = int(listID)
	return list, nil
}

func (db *DB) UpdateList(ctx context.Context, listID int, listVersion int, userID int, now time.Time, update func(listData *ListData) error) (*List, error) {
	txn, err := db.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}

	newList, err := db.doUpdateList(ctx, txn, listID, listVersion, userID, now, update)
	if err != nil {
		_ = txn.Rollback()
		return nil, err
	}

	if err := txn.Commit(); err != nil {
		return nil, err
	}

	return newList, nil
}

func (db *DB) doUpdateList(ctx context.Context, txn *sql.Tx, listID int, listVersion int, userID int, now time.Time, update func(listData *ListData) error) (*List, error) {
	readQuery := `SELECT version, owner, name, beneficiary, event_date,
                             created, active
                        FROM lists
                       WHERE id = @id`

	list := &List{ID: listID}
	err := txn.QueryRowContext(ctx, readQuery, sql.Named("id", listID)).Scan(
		&list.Version, &list.OwnerID, &list.Name,
		&list.Beneficiary, asSeconds{&list.EventDate},
		asSeconds{&list.Created}, &list.Active)
	if err != nil {
		return nil, err
	}

	if list.Version != listVersion {
		return nil, status.Errorf(codes.FailedPrecondition,
			"version ID mismatch; got %v want %v",
			listVersion, list.Version)
	}

	if list.OwnerID != userID {
		return nil, status.Errorf(codes.PermissionDenied,
			"user %v does not own list %v (owner %v)",
			userID, list.ID, list.OwnerID)
	}

	if err := update(&list.ListData); err != nil {
		return nil, err
	}

	list.Version++
	list.Updated = now

	writeQuery := `UPDATE lists
                          SET ( name, beneficiary, event_date, active,
                                version, updated ) =
                              ( @name, @beneficiary, @event_date, @active,
                                @version, @updated )
                        WHERE id = @id`

	_, err = txn.ExecContext(ctx, writeQuery,
		sql.Named("name", list.Name),
		sql.Named("beneficiary", list.Beneficiary),
		sql.Named("event_date", list.EventDate.Unix()),
		sql.Named("active", list.Active),
		sql.Named("version", list.Version),
		sql.Named("updated", list.Updated.Unix()),
		sql.Named("id", listID))
	if err != nil {
		return nil, fmt.Errorf("write failed: %v", err)
	}

	return list, err
}

type ListFilter struct {
	where string
}

func OnlyListWithID(id int) ListFilter {
	return ListFilter{fmt.Sprintf("id = %d", id)}
}

func IncludeInactiveLists(include bool) ListFilter {
	if include {
		return ListFilter{}
	}
	return ListFilter{"active = TRUE"}
}

func (db *DB) ListLists(ctx context.Context, filter ListFilter) ([]*List, error) {
	query := `SELECT id, version, owner, name, beneficiary,
                         event_date, created, updated, active
                  FROM lists`
	if filter.where != "" {
		query += " WHERE " + filter.where
	}

	lists := []*List{}
	rows, err := db.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		list := &List{}
		err := rows.Scan(&list.ID, &list.Version, &list.OwnerID,
			&list.Name, &list.Beneficiary,
			asSeconds{&list.EventDate},
			asSeconds{&list.Created}, asSeconds{&list.Updated},
			&list.Active)
		if err != nil {
			return nil, err
		}
		lists = append(lists, list)
	}

	return lists, nil
}
