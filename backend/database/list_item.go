package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type ListItemData struct {
	Name string
	Desc string
	URL  string
}

type ListItem struct {
	ListItemData

	ID          int
	Version     int
	ListID      int
	Created     time.Time
	Updated     time.Time
	ClaimedBy   int
	ClaimedWhen time.Time
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

func (db *DB) ListListItems(ctx context.Context, listID int) ([]*ListItem, error) {
	query := `SELECT id, version, name, desc, url, created, updated,
	                 claimed_by, claimed_when
	          FROM items
                  WHERE list_id = ?
	          ORDER BY id ASC`

	items := []*ListItem{}
	rows, err := db.db.QueryContext(ctx, query, listID)
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
		items = append(items, item)
	}

	return items, nil
}

//  rpc CreateListItem(CreateListItemRequest) returns (CreateListItemResponse);
//  rpc DeleteListItem(DeleteListItemRequest) returns (DeleteListItemResponse);
//  rpc UpdateListItem(UpdateListItemRequest) returns (UpdateListItemResponse);
