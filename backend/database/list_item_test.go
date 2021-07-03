package database_test

import (
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
)

func TestCreateAndListListItems(t *testing.T) {
	db := setupTestDatabase(t)
	defer db.Close()
	createTestUsers(t, db, []string{"a", "b"})

	listSetupRequests := []*testutil.ListSetupRequest{
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

	listResponses := testutil.SetupLists(ctx, t, db, listSetupRequests)
	for i, listResponse := range listResponses {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			gotItems, err := db.ListListItems(
				ctx, listResponse.List.ID)
			if err != nil || !reflect.DeepEqual(gotItems, listResponse.ListItems) {
				t.Errorf("ListListItems(_, %d) = %+v, %v, "+
					"want %+v, nil",
					listResponse.List.ID, gotItems, err,
					listResponse.ListItems)
				return
			}
		})
	}

}
