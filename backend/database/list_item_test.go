package database

import (
	"reflect"
	"strconv"
	"testing"
	"time"
)

func TestCreateAndListListItems(t *testing.T) {
	if err := deleteAllLists(); err != nil {
		t.Errorf("failed to delete lists: %v", err)
		return
	}

	listSetupRequests := []*listSetupRequest{
		&listSetupRequest{
			Owner: "a",
			List: &ListData{Name: "l1", Beneficiary: "b1",
				EventDate: time.Unix(1, 0), Active: true},
			ListItems: []*ListItemData{
				&ListItemData{
					Name: "l1i1", Desc: "l1i1desc",
					URL: "l1i1url",
				},
				&ListItemData{
					Name: "l1i2", Desc: "l1i2desc",
					URL: "l1i2url",
				},
			},
		},
		&listSetupRequest{
			Owner: "b",
			List: &ListData{Name: "l2", Beneficiary: "b2",
				EventDate: time.Unix(2, 0), Active: true},
			ListItems: []*ListItemData{
				&ListItemData{
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
