package database_test

import (
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
)

func userIDs(users []*database.User) []int {
	ids := []int{}
	for _, user := range users {
		ids = append(ids, user.ID)
	}
	return ids
}

func TestAuthenticateUser(t *testing.T) {
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a"})

	user := users.UserByUsername("a")
	password := users.PasswordByID(user.ID)
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

func TestSetPassword(t *testing.T) {
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a", "b"})

	userA := users.UserByUsername("a")
	userB := users.UserByUsername("b")
	oldPassword := users.PasswordByID(userA.ID)
	newPassword := oldPassword + "_new"

	created := time.Unix(1000, 0)
	expiry := time.Unix(2000, 0)
	sessA, err := db.CreateSession(ctx, userA.ID, created, expiry)
	if err != nil {
		t.Fatalf("CreateSession(_, %v, ...) = _, %v, want _, nil",
			userA.ID, err)
	}
	sessB, err := db.CreateSession(ctx, userB.ID, created, expiry)
	if err != nil {
		t.Fatalf("CreateSession(_, %v, ...) = _, %v, want _, nil",
			userB.ID, err)
	}

	if got, err := db.SetPassword(ctx, userA.Username, newPassword); err != nil || got != 1 {
		t.Errorf(`SetPassword(_, "%v", "%v") = %v, %v, want 1, nil`,
			userA.Username, newPassword, got, err)
	}

	if _, err := db.AuthenticateUser(ctx, userA.Username, oldPassword); err == nil {
		t.Errorf(`AuthenticateUser(_, "%v", "%v") = _, nil, want _, err`,
			userA.Username, oldPassword)
	}
	if got, err := db.AuthenticateUser(ctx, userA.Username, newPassword); err != nil || got != userA.ID {
		t.Errorf(`AuthenticateUser(_, "%v", "%v") = %v, %v, want %v, nil`,
			userA.Username, newPassword, got, err, userA.ID)
	}

	// a's session is gone; b's is untouched.
	if got, err := db.LookupSession(ctx, sessA.ID); err != nil || got != nil {
		t.Errorf("LookupSession(_, %v) = %v, %v, want nil, nil",
			sessA.ID, got, err)
	}
	if got, err := db.LookupSession(ctx, sessB.ID); err != nil || got == nil {
		t.Errorf("LookupSession(_, %v) = %v, %v, want session, nil",
			sessB.ID, got, err)
	}

	// No sessions left to delete.
	if got, err := db.SetPassword(ctx, userA.Username, newPassword); err != nil || got != 0 {
		t.Errorf(`SetPassword(_, "%v", "%v") = %v, %v, want 0, nil`,
			userA.Username, newPassword, got, err)
	}

	badUsername := userA.Username + "zz"
	if _, err := db.SetPassword(ctx, badUsername, newPassword); err == nil {
		t.Errorf(`SetPassword(_, "%v", _) = _, nil, want _, err`,
			badUsername)
	}
}

func TestLookupUser(t *testing.T) {
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a", "b", "c"})

	for _, resp := range users {
		user := resp.User
		gotUser, err := db.LookupUserByID(ctx, user.ID)
		if err != nil || !reflect.DeepEqual(gotUser, user) {
			t.Errorf("LookupUser(_, %v) = %+v, %v, want %+v, nil",
				user.ID, gotUser, err, user)
		}

		gotUser, err = db.LookupUserByUsername(ctx, user.Username)
		if err != nil || !reflect.DeepEqual(gotUser, user) {
			t.Errorf("LookupUser(_, %v) = %+v, %v, want %+v, nil",
				user.Username, gotUser, err, user)
		}

		badUsername := user.Username + "zz"
		gotUser, err = db.LookupUserByUsername(ctx, badUsername)
		if err != nil || gotUser != nil {
			t.Errorf("LookupUser(_, %v) = %v, %v, want nil, nil",
				badUsername, gotUser, err)
		}
	}
}

func TestListUsers(t *testing.T) {
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a", "b", "c"})

	want := []*database.User{}
	for _, resp := range users {
		want = append(want, resp.User)
	}
	sort.Sort(database.UsersByID(want))

	got, err := db.ListUsers(ctx)
	if err != nil {
		t.Errorf("ListUsers() = %v, want nil", err)
		return
	}
	sort.Sort(database.UsersByID(got))

	if !reflect.DeepEqual(want, got) {
		t.Errorf("ListUsers() = %+v, want %+v", got, want)
	}
}

func TestUsersByID(t *testing.T) {
	users := []*database.User{
		&database.User{Username: "c", Fullname: "User C"},
		&database.User{Username: "a", Fullname: "User A"},
		&database.User{Username: "b", Fullname: "User B"},
	}

	tmp := make([]*database.User, len(users))
	copy(tmp, users)

	wantIDs := userIDs(tmp)
	sort.Ints(wantIDs)

	sort.Sort(database.UsersByID(tmp))
	gotIDs := userIDs(tmp)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort; want %v, got %v", wantIDs, gotIDs)
	}

	sort.Sort(sort.Reverse(sort.IntSlice(wantIDs)))

	sort.Sort(sort.Reverse(database.UsersByID(tmp)))
	gotIDs = userIDs(tmp)
	if !reflect.DeepEqual(wantIDs, gotIDs) {
		t.Errorf("sort rev; want %v, got %v", wantIDs, gotIDs)
	}
}
