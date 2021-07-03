package database_test

import (
	"fmt"
	"reflect"
	"sort"
	"testing"
	"unicode"
	"unicode/utf8"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
)

func createTestUsers(t *testing.T, db *database.DB, usernames []string) testutil.UserSetupResponses {
	reqs := []*testutil.UserSetupRequest{}
	for _, username := range usernames {
		r, _ := utf8.DecodeRuneInString(username)
		isAdmin := unicode.IsUpper(r)

		reqs = append(reqs, &testutil.UserSetupRequest{
			Username: username,
			Fullname: fmt.Sprintf("User %v", username),
			Password: username + username,
			Admin:    isAdmin,
		})
	}

	return testutil.SetupUsers(ctx, t, db, reqs)
}

func userIDs(users []*database.User) []int {
	ids := []int{}
	for _, user := range users {
		ids = append(ids, user.ID)
	}
	return ids
}

func TestAuthenticateUser(t *testing.T) {
	db := setupTestDatabase(t)
	defer db.Close()
	users := createTestUsers(t, db, []string{"a"})

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

func TestLookupUser(t *testing.T) {
	db := setupTestDatabase(t)
	defer db.Close()
	users := createTestUsers(t, db, []string{"a", "b", "c"})

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
	db := setupTestDatabase(t)
	defer db.Close()
	users := createTestUsers(t, db, []string{"a", "b", "c"})

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
