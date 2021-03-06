package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
)

type ListSetupRequest struct {
	Owner     string
	List      *database.ListData
	ListItems []*database.ListItemData
}

type ListSetupResponse struct {
	List      *database.List
	ListItems []*database.ListItem
}

type ListSetupResponses []*ListSetupResponse

func (a ListSetupResponses) GetList(listName string) *ListSetupResponse {
	for _, r := range a {
		if r.List.Name == listName {
			return r
		}
	}
	return nil
}

func (a ListSetupResponses) GetItem(listName, itemName string) (*database.List, *database.ListItem) {
	r := a.GetList(listName)
	if r == nil {
		return nil, nil
	}

	for _, item := range r.ListItems {
		if item.Name == itemName {
			return r.List, item
		}
	}
	return r.List, nil
}

const (
	SetupListsBaseStamp int64 = 1000
	SetupListsUserStamp int64 = 100000
)

func SetupLists(ctx context.Context, t *testing.T, db *database.DB, reqs []*ListSetupRequest) ListSetupResponses {
	resps := []*ListSetupResponse{}
	stamp := int64(SetupListsBaseStamp)
	for _, req := range reqs {
		resp := &ListSetupResponse{}

		user, err := db.LookupUserByUsername(ctx, req.Owner)
		if err != nil {
			t.Fatalf("lookupuser: %v", err)
		}

		list, err := db.CreateList(ctx, user.ID, req.List, time.Unix(stamp, 0))
		if err != nil {
			t.Fatalf("createlist: %v", err)
		}

		resp.List = list

		for i, listItemData := range req.ListItems {
			listItem, err := db.CreateListItem(
				ctx, list.ID, listItemData,
				time.Unix(stamp+10*int64(i), 0))
			if err != nil {
				t.Fatalf("createlistitem #%d: %v", i, err)
			}
			resp.ListItems = append(resp.ListItems, listItem)
		}

		stamp += 1000
		resps = append(resps, resp)
	}

	return resps
}
