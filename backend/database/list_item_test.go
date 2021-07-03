package database_test

import (
	"fmt"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
)

func TestCreateAndListListItems(t *testing.T) {
	if err := db.DeleteAllLists(ctx); err != nil {
		t.Errorf("failed to delete lists: %v", err)
		return
	}

	fmt.Printf("%v\n", testutil.Foo{})

	listSetupRequests := []*listSetupRequest{
		&listSetupRequest{
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
		&listSetupRequest{
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

	listResponses, err := setupLists(ctx, listSetupRequests)
	if err != nil {
		t.Errorf("setupLists failed: %v", err)
		return
	}

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
