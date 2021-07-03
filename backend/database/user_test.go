package database_test

import (
	"reflect"
	"sort"
	"testing"

	"github.com/simmonmt/xmaslist/backend/database"
)

func userIDs(users []*database.User) []int {
	ids := []int{}
	for _, user := range users {
		ids = append(ids, user.ID)
	}
	return ids
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
	got, err := db.ListUsers(ctx)
	if err != nil {
		t.Errorf("ListUsers() = %v, want nil", err)
		return
	}

	sort.Sort(database.UsersByID(got))
	if !reflect.DeepEqual(users, got) {
		t.Errorf("ListUsers() = %+v, want %+v", users, got)
	}
}

func TestUsersByID(t *testing.T) {
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
