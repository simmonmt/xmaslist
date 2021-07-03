package database_test

import (
	"context"
	"fmt"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
)

func createListItemTestLists(t *testing.T, db *database.DB) testutil.ListSetupResponses {
	reqs := []*testutil.ListSetupRequest{
		&testutil.ListSetupRequest{
			Owner: "a",
			List: &database.ListData{Name: "l1", Beneficiary: "b1",
				EventDate: time.Unix(1, 0), Active: true},
			ListItems: []*database.ListItemData{
				&database.ListItemData{
					Name: "l1i1", Desc: "l1i1desc",
					URL: "l1i1url",
				},
				&database.ListItemData{
					Name: "l1i2", Desc: "l1i2desc",
					URL: "l1i2url",
				},
			},
		},
		&testutil.ListSetupRequest{
			Owner: "b",
			List: &database.ListData{Name: "l2", Beneficiary: "b2",
				EventDate: time.Unix(2, 0), Active: true},
			ListItems: []*database.ListItemData{
				&database.ListItemData{
					Name: "l2i1", Desc: "l2i1desc",
					URL: "l2i1url",
				},
			},
		},
	}

	return testutil.SetupLists(ctx, t, db, reqs)
}

func readListItem(ctx context.Context, db *database.DB, listID int, itemID int) (*database.ListItem, error) {
	items, err := db.ListListItems(ctx, listID, database.OnlyItemWithID(itemID))
	if err != nil {
		return nil, err
	}

	if len(items) != 1 {
		return nil, fmt.Errorf("returned %d elems, wanted 1",
			len(items))
	}

	return items[0], nil
}

func TestCreateAndListListItems(t *testing.T) {
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	testutil.CreateTestUsers(ctx, t, db, []string{"a", "b"})
	resps := createListItemTestLists(t, db)

	for i, resp := range resps {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			listID := resp.List.ID
			listItems := resp.ListItems

			gotItems, err := db.ListListItems(
				ctx, listID, database.AllItems())
			if err != nil || !reflect.DeepEqual(gotItems, listItems) {
				t.Errorf("ListListItems(_, %d, all) = %+v, %v, "+
					"want %+v, nil",
					listID, gotItems, err, listItems)
				return
			}

			for _, item := range listItems {
				t.Run(strconv.Itoa(item.ID), func(t *testing.T) {
					gotItems, err := db.ListListItems(
						ctx, listID,
						database.OnlyItemWithID(item.ID))

					wantItems := []*database.ListItem{item}

					if err != nil || !reflect.DeepEqual(gotItems, wantItems) {
						t.Errorf("ListListItems(_, %d, only %d) = "+
							"%+v, %v, want %+v, nil",
							listID, item.ID, gotItems, err, wantItems)
						return
					}
				})
			}
		})
	}

}

func TestUpdateListItems_Claim(t *testing.T) {
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a", "b"})
	resps := createListItemTestLists(t, db)

	// The claim user is intentionally different from the list
	// user. Verifies that the database layer doesn't accidentally use the
	// list owner as the claimed-by user, and also tries to make sure it's
	// not doing any auth checks.
	claimUser := users.UserByUsername("b")

	list, item := resps.GetItem("l1", "l1i1")
	if list == nil || item == nil || item.ClaimedBy != 0 || list.OwnerID == claimUser.ID {
		t.Errorf("bad test data")
		return
	}

	// Item isn't claimed. Verify that that's the case, then claim it.
	now := time.Unix(testutil.SetupListsUserStamp, 0)
	_, err := db.UpdateListItem(ctx, list.ID, item.ID, item.Version, now, func(data *database.ListItemData, state *database.ListItemState) error {
		if !reflect.DeepEqual(data, &item.ListItemData) {
			return fmt.Errorf(
				"update cb unexpected data; got %v, want %v",
				data, &item.ListItemData)
		}
		if !reflect.DeepEqual(state, &item.ListItemState) {
			return fmt.Errorf(
				"update cb unexpected state; got %v, want %v",
				state, &item.ListItemState)
		}

		state.ClaimedBy = claimUser.ID
		return nil
	})
	if err != nil {
		t.Errorf("UpdateListItem failed: %v", err)
		return
	}

	// Double-check that it's claimed.

	wantItem := *item
	wantItem.Updated = now
	wantItem.ClaimedBy = claimUser.ID
	wantItem.ClaimedWhen = now

	if got, err := readListItem(ctx, db, list.ID, wantItem.ID); err != nil || !reflect.DeepEqual(got, &wantItem) {
		t.Errorf(`readListItem(_, %d, %d) = %v, %v, want nil, %v`,
			list.ID, item.ID, got, err, &wantItem)
		return
	}

	// Item is claimed. Verify that that's the case then unclaim it.
	now = now.Add(time.Duration(1000) * time.Second)
	_, err = db.UpdateListItem(ctx, list.ID, item.ID, item.Version, now, func(data *database.ListItemData, state *database.ListItemState) error {
		// No change from initial update call
		if !reflect.DeepEqual(data, &wantItem.ListItemData) {
			return fmt.Errorf(
				"update cb unexpected data; got %+v, want %+v",
				data, &wantItem.ListItemData)
		}

		// Now it should be claimed
		if !reflect.DeepEqual(state, &wantItem.ListItemState) {
			return fmt.Errorf(
				"update cb unexpected state; got %+v, want %+v",
				state, &wantItem.ListItemState)
		}

		// Unclaim it
		state.ClaimedBy = 0
		return nil
	})
	if err != nil {
		t.Errorf("UpdateListItem failed: %v", err)
		return
	}

	// Double-check that it's unclaimed

	wantItem.Updated = now
	wantItem.ClaimedBy = 0
	wantItem.ClaimedWhen = time.Time{}

	if got, err := readListItem(ctx, db, list.ID, wantItem.ID); err != nil || !reflect.DeepEqual(got, &wantItem) {
		t.Errorf(`readListItem(_, %d, %d) = %+v, %v, want %+v, nil`,
			list.ID, item.ID, got, err, &wantItem)
		return
	}

}
