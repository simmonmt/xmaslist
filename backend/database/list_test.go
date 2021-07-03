package database_test

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func listIDs(lists []*database.List) []int {
	ids := []int{}
	for _, list := range lists {
		ids = append(ids, list.ID)
	}
	return ids
}

func TestListsByID(t *testing.T) {
	lists := []*database.List{
		&database.List{ID: 3},
		&database.List{ID: 5},
		&database.List{ID: 1},
	}

	wantIDs := listIDs(lists)
	sort.Ints(wantIDs)

	sort.Sort(database.ListsByID(lists))
	gotIDs := listIDs(lists)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort; want %v, got %v", wantIDs, gotIDs)
	}

	sort.Sort(sort.Reverse(sort.IntSlice(wantIDs)))

	sort.Sort(sort.Reverse(database.ListsByID(lists)))
	gotIDs = listIDs(lists)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort rev; want %v, got %v", wantIDs, gotIDs)
	}
}

func TestCreateAndListLists(t *testing.T) {
	db := setupTestDatabase(t)
	defer db.Close()
	createTestUsers(t, db, []string{"a", "b"})

	listSetupRequests := []*testutil.ListSetupRequest{
		&testutil.ListSetupRequest{
			Owner: "a",
			List: &database.ListData{Name: "l1", Beneficiary: "b1",
				EventDate: time.Unix(1, 0), Active: true},
		},
		&testutil.ListSetupRequest{
			Owner: "b",
			List: &database.ListData{Name: "l2", Beneficiary: "b2",
				EventDate: time.Unix(2, 0), Active: true},
		},
	}
	listResponses := testutil.SetupLists(ctx, t, db, listSetupRequests)

	got, err := db.ListLists(ctx, database.IncludeInactiveLists(true))
	if err != nil {
		t.Errorf("ListLists(include_inactive=true) = %v, want nil",
			err)
		return
	}

	want := []*database.List{listResponses[0].List, listResponses[1].List}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ListLists(include_inactive=true) = %v, want %v",
			got, want)
		return
	}

	got, err = db.ListLists(ctx, database.OnlyListWithID(listResponses[1].List.ID))
	if err != nil {
		t.Errorf("ListLists(only=%d) = _, %v, want _, nil",
			listResponses[1].List.ID, err)
		return
	}

	want = []*database.List{listResponses[1].List}
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

func readList(ctx context.Context, db *database.DB, listID int) (*database.List, error) {
	lists, err := db.ListLists(ctx, database.OnlyListWithID(listID))
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
	db := setupTestDatabase(t)
	defer db.Close()
	users := createTestUsers(t, db, []string{"a", "b"})

	listData := &database.ListData{Name: "ul", Beneficiary: "bul",
		EventDate: time.Unix(3, 0), Active: true}
	owner := users.UserByUsername("a")
	otherUser := users.UserByUsername("b")
	created := time.Unix(3000, 0)
	updated := time.Unix(4000, 0)

	list, err := db.CreateList(ctx, owner.ID, listData, created)
	if err != nil {
		t.Errorf("failed to create list: %v", err)
		return
	}

	_, err = db.UpdateList(ctx, list.ID, list.Version+1, owner.ID,
		updated, func(listData *database.ListData) error { panic("unreached") })
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

	if got, err := readList(ctx, db, list.ID); err != nil || !reflect.DeepEqual(list, got) {
		t.Errorf("list unexpectedly changed: want %+v, got %+v",
			list, got)
		return
	}

	_, err = db.UpdateList(ctx, list.ID, list.Version, otherUser.ID,
		updated, func(listData *database.ListData) error { panic("unreached") })
	if err == nil {
		t.Errorf("UpdateList(bad user %v) = %v, want nil",
			otherUser.ID, err)
		return
	}
	if code, err := statusCode(err); err != nil || code != codes.PermissionDenied {
		t.Errorf("UpdateList(bad user %v) error want status permission denied, got %v, %v",
			otherUser.ID, code, err)
	}

	if got, err := readList(ctx, db, list.ID); err != nil || !reflect.DeepEqual(list, got) {
		t.Errorf("list unexpectedly changed: want %+v, got %+v",
			list, got)
		return
	}

	want := *list
	want.Version++
	want.Name = "UL"
	want.Active = false
	want.Updated = updated

	got, err := db.UpdateList(ctx, list.ID, list.Version, owner.ID, updated,
		func(listData *database.ListData) error {
			listData.Name = "UL"
			listData.Active = false
			return nil
		})
	if err != nil || !reflect.DeepEqual(&want, got) {
		t.Errorf("UpdateList() = %v, %v, want %v, nil",
			got, err, &want)
		return
	}

	if got, err := readList(ctx, db, list.ID); err != nil || !reflect.DeepEqual(&want, got) {
		t.Errorf("list didn't change: want %+v, got %+v",
			&want, got)
		return
	}
}
