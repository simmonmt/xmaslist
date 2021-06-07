package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"reflect"
	"sort"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/simmonmt/xmaslist/db/schema"
)

var (
	ctx = context.Background()

	users = []*User{
		&User{Username: "a", Fullname: "User A", Admin: false},
		&User{Username: "b", Fullname: "User B", Admin: false},
	}
	usersByUsername = map[string]int{}

	passwords = map[string]string{
		"a": "aa",
		"b": "bb",
	}

	db *DB
)

func createTestDatabase() (db *DB, err error) {
	db, err = Open(":memory")
	if err != nil {
		return nil, err
	}

	if _, err := db.db.ExecContext(ctx, schema.Get()); err != nil {
		return nil, err
	}

	for _, user := range users {
		password := passwords[user.Username]
		var userID int
		userID, err = db.AddUser(ctx, user, password)
		if err != nil {
			panic(fmt.Sprintf("AddUser(_, %v, %v) = _, %v, want _, nil", user, password, err))
			return
		}

		user.ID = userID
		usersByUsername[user.Username] = userID
	}

	sort.Sort(UsersByID(users))

	return db, nil
}

func deleteAllSessions() error {
	_, err := db.db.ExecContext(ctx, `DELETE FROM SESSIONS`)
	return err
}

func userIDs(users []*User) []int {
	ids := []int{}
	for _, user := range users {
		ids = append(ids, user.ID)
	}
	return ids
}

func listIDs(lists []*List) []int {
	ids := []int{}
	for _, list := range lists {
		ids = append(ids, list.ID)
	}
	return ids
}

func TestAsSeconds(t *testing.T) {
	tm := time.Time{}
	var s sql.Scanner = asSeconds{&tm}
	if err := s.Scan(int64(1000)); err != nil {
		t.Errorf("s.Scan(1000) = %v, want nil", err)
		return
	}

	if got := tm.Unix(); got != 1000 {
		t.Errorf("tm.Unix() = %v, want 1000", tm.Unix())
	}
}

func TestAuthenticateUser(t *testing.T) {
	user := users[0]
	password := passwords[user.Username]
	invalidPassword := password + "_invalid"

	_, err := db.AuthenticateUser(ctx, user.Username, invalidPassword)
	if err == nil {
		t.Errorf(`AuthenticateUser(_, "%v", "%v") = _, nil, want _, err`,
			user, invalidPassword)
	}

	wantUserID := user.ID
	gotUserID, err := db.AuthenticateUser(ctx, user.Username, password)
	if err != nil || gotUserID != wantUserID {
		t.Errorf(`AuthenticateUser(_, "%v", "%v") = %v, %v, want %v, nil`,
			user.Username, password, gotUserID, err, wantUserID)
	}
}

func TestLookupUser(t *testing.T) {
	for _, user := range users {
		gotUser, err := db.LookupUserByID(ctx, user.ID)
		if err != nil || !reflect.DeepEqual(gotUser, user) {
			t.Errorf("LookupUser(_, %v) = %+v, %v, want %+v, nil",
				user.ID, gotUser, err, user)
		}
	}
}

func TestListUsers(t *testing.T) {
	got, err := db.ListUsers(ctx)
	if err != nil {
		t.Errorf("ListUsers() = %v, want nil", err)
		return
	}

	sort.Sort(UsersByID(got))
	if !reflect.DeepEqual(users, got) {
		t.Errorf("ListUsers() = %+v, want %+v", users, got)
	}
}

func TestUsersByID(t *testing.T) {
	tmp := make([]*User, len(users))
	copy(tmp, users)

	wantIDs := userIDs(tmp)
	sort.Ints(wantIDs)

	sort.Sort(UsersByID(tmp))
	gotIDs := userIDs(tmp)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort; want %v, got %v", wantIDs, gotIDs)
	}

	sort.Sort(sort.Reverse(sort.IntSlice(wantIDs)))

	sort.Sort(sort.Reverse(UsersByID(tmp)))
	gotIDs = userIDs(tmp)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort rev; want %v, got %v", wantIDs, gotIDs)
	}
}

func TestSessions(t *testing.T) {
	user := users[0]
	created := time.Unix(1000, 0)
	expiry := time.Unix(2000, 0)

	if err := deleteAllSessions(); err != nil {
		panic(fmt.Sprintf("failed to clean sessions: %v", err))
	}

	// create session 1
	gotSess, err := db.CreateSession(ctx, user.ID, created, expiry)
	wantSess := &Session{
		ID:      gotSess.ID,
		UserID:  user.ID,
		Created: created,
		Expiry:  expiry,
	}

	if err != nil || !reflect.DeepEqual(gotSess, wantSess) {
		t.Errorf(`CreateSession 1 (_, "%v", %v, %v) = %+v, %v, want %+v, nil`,
			user.ID, created, expiry, gotSess, err, wantSess)
		return
	}

	sess1ID := gotSess.ID

	// verify session 1 exists
	gotSess, err = db.LookupSession(ctx, sess1ID)
	if err != nil || !reflect.DeepEqual(gotSess, wantSess) {
		t.Errorf(`LookupSession(_, %v) = %+v, %v, want %+v, nil`,
			sess1ID, gotSess, err, wantSess)
		return
	}

	// create session 2
	created = created.Add(time.Hour)
	expiry = expiry.Add(time.Hour)

	gotSess, err = db.CreateSession(ctx, user.ID, created, expiry)
	wantSess = &Session{
		ID:      gotSess.ID,
		UserID:  user.ID,
		Created: created,
		Expiry:  expiry,
	}

	if err != nil || !reflect.DeepEqual(gotSess, wantSess) {
		t.Errorf(`CreateSession 2 (_, "%v", %v, %v) = %+v, %v, want %+v, nil`,
			user.ID, created, expiry, gotSess, err, wantSess)
		return
	}

	sess2ID := gotSess.ID

	if sess1ID == sess2ID {
		t.Errorf(`sess1ID %v == sess2ID %v`, sess1ID, sess2ID)
		return
	}

	// verify session 1 doesn't exist, session 2 does
	gotSess, err = db.LookupSession(ctx, sess1ID)
	if err != nil || gotSess != nil {
		t.Errorf(`LookupSession(_, %v) = %+v, %v, want nil, nil`,
			sess1ID, gotSess, err)
		return
	}
	gotSess, err = db.LookupSession(ctx, sess2ID)
	if err != nil || !reflect.DeepEqual(gotSess, wantSess) {
		t.Errorf(`LookupSession(_, %v) = %+v, %v, want %+v, nil`,
			sess1ID, gotSess, err, wantSess)
		return
	}

	// delete session 2
	if err := db.DeleteSession(ctx, sess2ID); err != nil {
		t.Errorf(`DeleteSession(_, %v) = %v, want nil`, sess1ID, err)
		return
	}

	// verify session 2 doesn't exist
	gotSess, err = db.LookupSession(ctx, sess2ID)
	if err != nil || gotSess != nil {
		t.Errorf(`LookupSession(_, %v) = %+v, %v, want nil, nil`,
			sess2ID, gotSess, err)
		return
	}

	// delete session 2 again (expect noop)
	if err := db.DeleteSession(ctx, sess2ID); err != nil {
		t.Errorf(`DeleteSession(_, %v) = %v, want nil`, sess1ID, err)
		return
	}
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

func TestListLists(t *testing.T) {
	makeStamp := func(userID int) time.Time {
		return time.Unix(int64(userID*1000), 0)
	}

	listDatas := map[string]*ListData{
		"a": &ListData{Name: "l1", Beneficiary: "b1",
			EventDate: time.Unix(1, 0), Active: true},
		"b": &ListData{Name: "l2", Beneficiary: "b2",
			EventDate: time.Unix(2, 0), Active: true},
	}

	lists := []*List{}

	for owner, listData := range listDatas {
		ownerID := usersByUsername[owner]
		stamp := makeStamp(ownerID)

		list, err := db.CreateList(ctx, ownerID, listData, stamp)
		if err != nil {
			t.Errorf("CreateList(_, %v, %+v, %v) = %v, %v, want _, nil",
				ownerID, listData, stamp, list, err)
			return
		}

		lists = append(lists, list)
	}

	got, err := db.ListLists(ctx, IncludeInactiveLists(true))
	if err != nil {
		t.Errorf("ListLists(include_inactive=true) = %v, want nil",
			err)
		return
	}

	sort.Sort(ListsByID(lists))
	if !reflect.DeepEqual(got, lists) {
		t.Errorf("ListLists(include_inactive=true) = %v, want %v",
			got, lists)
		return
	}

	got, err = db.ListLists(ctx, OnlyListWithID(lists[1].ID))
	if err != nil {
		t.Errorf("ListLists(only=%d) = _, %v, want _, nil",
			lists[1].ID, err)
		return
	}

	if len(got) != 1 {
		t.Errorf("ListLists(only=%d) returned %d elems, wanted 1",
			lists[1].ID, len(got))
		return
	}

	want := lists[1]
	if !reflect.DeepEqual(got[0], want) {
		t.Errorf("ListLists(only=%d) = [%+v], nil, want [%+v], nil",
			lists[1].ID, got[0], want)
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

func TestMain(m *testing.M) {
	var err error
	db, err = createTestDatabase()
	if err != nil {
		panic(fmt.Sprintf("failed to create database: %v", err))
	}

	os.Exit(m.Run())
}
