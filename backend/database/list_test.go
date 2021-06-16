package database

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type listSetupRequest struct {
	Owner     string
	List      *ListData
	ListItems []*ListItemData
}

type listSetupResponse struct {
	List      *List
	ListItems []*ListItem
}

func setupLists(ctx context.Context, reqs []*listSetupRequest) ([]*listSetupResponse, error) {
	resps := []*listSetupResponse{}
	stamp := int64(1000)
	for _, req := range reqs {
		resp := &listSetupResponse{}

		user, err := db.LookupUserByUsername(ctx, req.Owner)
		if err != nil {
			return nil, fmt.Errorf("lookupuser: %v", err)
		}

		list, err := db.CreateList(ctx, user.ID, req.List, time.Unix(stamp, 0))
		if err != nil {
			return nil, fmt.Errorf("createlist: %v", err)
		}

		resp.List = list

		for i, listItemData := range req.ListItems {
			listItem, err := db.CreateListItem(
				ctx, list.ID, listItemData,
				time.Unix(stamp+10*int64(i), 0))
			if err != nil {
				return nil, fmt.Errorf("createlistitem #%d: %v", i, err)
			}
			resp.ListItems = append(resp.ListItems, listItem)
		}

		stamp += 1000
		resps = append(resps, resp)
	}

	return resps, nil
}

func deleteAllLists() error {
	_, err := db.db.ExecContext(ctx,
		`DELETE FROM items; DELETE FROM lists`)
	return err
}

func listIDs(lists []*List) []int {
	ids := []int{}
	for _, list := range lists {
		ids = append(ids, list.ID)
	}
	return ids
}

func TestListsByID(t *testing.T) {
	lists := []*List{
		&List{ID: 3},
		&List{ID: 5},
		&List{ID: 1},
	}

	wantIDs := listIDs(lists)
	sort.Ints(wantIDs)

	sort.Sort(ListsByID(lists))
	gotIDs := listIDs(lists)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort; want %v, got %v", wantIDs, gotIDs)
	}

	sort.Sort(sort.Reverse(sort.IntSlice(wantIDs)))

	sort.Sort(sort.Reverse(ListsByID(lists)))
	gotIDs = listIDs(lists)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort rev; want %v, got %v", wantIDs, gotIDs)
	}
}

func TestCreateAndListLists(t *testing.T) {
	if err := deleteAllLists(); err != nil {
		t.Errorf("failed to delete lists: %v", err)
		return
	}

	listSetupRequests := []*listSetupRequest{
		&listSetupRequest{
			Owner: "a",
			List: &ListData{Name: "l1", Beneficiary: "b1",
				EventDate: time.Unix(1, 0), Active: true},
		},
		&listSetupRequest{
			Owner: "b",
			List: &ListData{Name: "l2", Beneficiary: "b2",
				EventDate: time.Unix(2, 0), Active: true},
		},
	}

	listResponses, err := setupLists(ctx, listSetupRequests)
	if err != nil {
		t.Errorf("setupLists failed: %v", err)
		return
	}

	got, err := db.ListLists(ctx, IncludeInactiveLists(true))
	if err != nil {
		t.Errorf("ListLists(include_inactive=true) = %v, want nil",
			err)
		return
	}

	want := []*List{listResponses[0].List, listResponses[1].List}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ListLists(include_inactive=true) = %v, want %v",
			got, want)
		return
	}

	got, err = db.ListLists(ctx, OnlyListWithID(listResponses[1].List.ID))
	if err != nil {
		t.Errorf("ListLists(only=%d) = _, %v, want _, nil",
			listResponses[1].List.ID, err)
		return
	}

	want = []*List{listResponses[1].List}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ListLists(only=%d) = [%+v], nil, want [%+v], nil",
			listResponses[1].List.ID, got[0], want)
		return
	}
}

func statusCode(err error) (codes.Code, error) {
	s, ok := status.FromError(err)
	if !ok {
		return codes.Unknown, fmt.Errorf("not a status")
	}
	return s.Code(), nil
}

func readList(ctx context.Context, listID int) (*List, error) {
	lists, err := db.ListLists(ctx, OnlyListWithID(listID))
	if err != nil {
		return nil, err
	}

	if len(lists) != 1 {
		return nil, fmt.Errorf("returned %d elems, wanted 1",
			len(lists))
	}

	return lists[0], nil
}

func TestUpdateList(t *testing.T) {
	if err := deleteAllLists(); err != nil {
		t.Errorf("failed to delete lists: %v", err)
		return
	}

	listData := &ListData{Name: "ul", Beneficiary: "bul",
		EventDate: time.Unix(3, 0), Active: true}
	ownerID := usersByUsername["a"]
	otherUserID := usersByUsername["b"]
	created := time.Unix(3000, 0)
	updated := time.Unix(4000, 0)

	list, err := db.CreateList(ctx, ownerID, listData, created)
	if err != nil {
		t.Errorf("failed to create list: %v", err)
		return
	}

	_, err = db.UpdateList(ctx, list.ID, list.Version+1, ownerID,
		updated, func(listData *ListData) error { panic("unreached") })
	if err == nil {
		t.Errorf("UpdateList(bad version %v) = %v, want nil",
			list.Version+1, err)
		return
	}
	if code, err := statusCode(err); err != nil || code != codes.FailedPrecondition {
		t.Errorf("UpdateList(bad version %v) error want status failed precondition, got %v, %v",
			list.Version+1, code, err)
		return
	}

	if got, err := readList(ctx, list.ID); err != nil || !reflect.DeepEqual(list, got) {
		t.Errorf("list unexpectedly changed: want %+v, got %+v",
			list, got)
		return
	}

	_, err = db.UpdateList(ctx, list.ID, list.Version, otherUserID,
		updated, func(listData *ListData) error { panic("unreached") })
	if err == nil {
		t.Errorf("UpdateList(bad user %v) = %v, want nil",
			otherUserID, err)
		return
	}
	if code, err := statusCode(err); err != nil || code != codes.PermissionDenied {
		t.Errorf("UpdateList(bad user %v) error want status permission denied, got %v, %v",
			otherUserID, code, err)
	}

	if got, err := readList(ctx, list.ID); err != nil || !reflect.DeepEqual(list, got) {
		t.Errorf("list unexpectedly changed: want %+v, got %+v",
			list, got)
		return
	}

	want := *list
	want.Version++
	want.Name = "UL"
	want.Active = false
	want.Updated = updated

	got, err := db.UpdateList(ctx, list.ID, list.Version, ownerID, updated,
		func(listData *ListData) error {
			listData.Name = "UL"
			listData.Active = false
			return nil
		})
	if err != nil || !reflect.DeepEqual(&want, got) {
		t.Errorf("UpdateList() = %v, %v, want %v, nil",
			got, err, &want)
		return
	}

	if got, err := readList(ctx, list.ID); err != nil || !reflect.DeepEqual(&want, got) {
		t.Errorf("list didn't change: want %+v, got %+v",
			&want, got)
		return
	}
}