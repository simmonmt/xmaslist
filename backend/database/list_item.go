package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ListItemState struct {
	ClaimedBy int
}

type ListItemData struct {
	Name string
	Desc string
	URL  string
}

type ListItem struct {
	ListItemData
	ListItemState

	ID          int
	Version     int
	ListID      int
	Created     time.Time
	Updated     time.Time
	ClaimedWhen time.Time
}

type ItemFilter struct {
	where string
}

func AllItems() ItemFilter {
	return ItemFilter{}
}

func OnlyItemWithID(id int) ItemFilter {
	return ItemFilter{fmt.Sprintf("id = %d", id)}
}

func (db *DB) CreateListItem(ctx context.Context, listID int, itemData *ListItemData, now time.Time) (*ListItem, error) {
	item := &ListItem{
		ListItemData: *itemData,
		Version:      1,
		ListID:       listID,
		Created:      now,
		Updated:      now,
	}

	listInsert := `INSERT INTO items (version, list_id, name, desc, url,
	                                  created, updated)
	                      VALUES (?, ?, ?, ?, ?, ?, ?)`
	result, err := db.db.ExecContext(ctx, listInsert,
		item.Version, item.ListID,
		item.Name, item.Desc, item.URL,
		item.Created.Unix(), item.Updated.Unix())
	if err != nil {
		return nil, fmt.Errorf("item create failed: %v", err)
	}

	itemID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get item ID")
	}
	item.ID = int(itemID)

	return item, nil
}

func (db *DB) ListListItems(ctx context.Context, listID int, filter ItemFilter) ([]*ListItem, error) {
	query := `SELECT id, version, name, desc, url, created, updated,
	                 claimed_by, claimed_when
	          FROM items
                  WHERE list_id = @listID`
	if filter.where != "" {
		query += " AND " + filter.where
	}
	query += " ORDER BY id ASC"

	items := []*ListItem{}
	rows, err := db.db.QueryContext(ctx, query, sql.Named("listID", listID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		item := &ListItem{ListID: listID}
		var claimedBy sql.NullInt64
		var claimedWhen nullSeconds
		err := rows.Scan(&item.ID, &item.Version,
			&item.Name, &item.Desc, &item.URL,
			asSeconds{&item.Created}, asSeconds{&item.Updated},
			&claimedBy, &claimedWhen)
		if err != nil {
			return nil, err
		}

		if claimedBy.Valid {
			item.ClaimedBy = int(claimedBy.Int64)
		}
		if claimedWhen.Valid {
			item.ClaimedWhen = claimedWhen.Time
		}

		items = append(items, item)
	}

	return items, nil
}

func (db *DB) UpdateListItem(ctx context.Context, listID int, itemID int, itemVersion int, now time.Time, update func(data *ListItemData, state *ListItemState) error) (*ListItem, error) {
	txn, err := db.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}

	newItem, err := db.doUpdateListItem(ctx, txn, listID, itemID, itemVersion, now, update)
	if err != nil {
		_ = txn.Rollback()
		return nil, err
	}

	if err := txn.Commit(); err != nil {
		return nil, err
	}

	return newItem, nil
}

func (db *DB) doUpdateListItem(ctx context.Context, txn *sql.Tx, listID int, itemID int, itemVersion int, now time.Time, update func(data *ListItemData, state *ListItemState) error) (*ListItem, error) {
	readQuery := `SELECT version, name, desc, url, created, updated,
	                     claimed_by, claimed_when
	                FROM items
	               WHERE id = @id AND list_id = @listID`

	item := &ListItem{ID: itemID, ListID: listID}
	var claimedBy sql.NullInt64
	var claimedWhen nullSeconds
	err := txn.QueryRowContext(ctx, readQuery, sql.Named("id", itemID), sql.Named("listID", listID)).Scan(
		&item.Version,
		&item.Name, &item.Desc, &item.URL,
		asSeconds{&item.Created}, asSeconds{&item.Updated},
		&claimedBy, &claimedWhen)
	if err != nil {
		return nil, err
	}

	if claimedBy.Valid {
		item.ClaimedBy = int(claimedBy.Int64)
	}
	wasClaimed := claimedBy.Valid && claimedBy.Int64 != 0

	if claimedWhen.Valid {
		item.ClaimedWhen = claimedWhen.Time
	}

	if item.Version != itemVersion {
		return nil, status.Errorf(codes.FailedPrecondition,
			"item version ID mismatch; requested %v, need %v",
			itemVersion, item.Version)
	}

	if err := update(&item.ListItemData, &item.ListItemState); err != nil {
		return nil, err
	}

	isClaimed := item.ClaimedBy != 0

	claimedBy = sql.NullInt64{
		Int64: int64(item.ClaimedBy),
		Valid: item.ClaimedBy != 0,
	}

	claimedWhen.Valid = isClaimed
	if !wasClaimed && isClaimed {
		claimedWhen.Time = now // update time because claim change
		item.ClaimedWhen = now
	} else if !isClaimed {
		claimedWhen.Time = time.Time{}
		item.ClaimedWhen = time.Time{}
	}

	item.Version++
	item.Updated = now

	writeQuery := `UPDATE items
	                  SET ( version, name, desc, url, updated,
	                        claimed_by, claimed_when ) =
	                      ( @version, @name, @desc, @url, @updated,
	                        @claimedBy, @claimedWhen )
	                WHERE id = @id AND list_id = @listID`

	_, err = txn.ExecContext(ctx, writeQuery,
		sql.Named("version", item.Version),
		sql.Named("name", item.Name),
		sql.Named("desc", item.Desc),
		sql.Named("url", item.URL),
		sql.Named("updated", item.Updated.Unix()),
		sql.Named("claimedBy", claimedBy),
		sql.Named("claimedWhen", claimedWhen),
		sql.Named("id", itemID),
		sql.Named("listID", listID))
	if err != nil {
		return nil, fmt.Errorf("write failed: %v", err)
	}

	return item, err
}
