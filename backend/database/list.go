package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ListsByID []*List

func (a ListsByID) Len() int           { return len(a) }
func (a ListsByID) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a ListsByID) Less(i, j int) bool { return a[i].ID < a[j].ID }

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

func (db *DB) CreateList(ctx context.Context, ownerID int, listData *ListData, now time.Time) (*List, error) {
	list := &List{
		ListData: *listData,
		Version:  1,
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
			list.Version, listVersion)
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
                              ( @name, @beneficiary, @eventDate, @active,
                                @version, @updated )
                        WHERE id = @id`

	_, err = txn.ExecContext(ctx, writeQuery,
		sql.Named("name", list.Name),
		sql.Named("beneficiary", list.Beneficiary),
		sql.Named("eventDate", list.EventDate.Unix()),
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
	query += " ORDER BY id ASC"

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

func (db *DB) DeleteAllLists(ctx context.Context) error {
	_, err := db.db.ExecContext(ctx,
		`DELETE FROM items; DELETE FROM lists`)
	return err
}
