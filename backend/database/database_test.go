package database

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/db/schema"
)

var (
	ctx = context.Background()

	users = []*User{
		&User{Username: "a", Fullname: "User A", Admin: false},
		&User{Username: "b", Fullname: "User B", Admin: false},
	}

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
	}

	return db, nil
}

func deleteAllSessions() error {
	_, err := db.db.ExecContext(ctx, `DELETE FROM SESSIONS`)
	return err
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

func TestMain(m *testing.M) {
	var err error
	db, err = createTestDatabase()
	if err != nil {
		panic(fmt.Sprintf("failed to create database: %v", err))
	}

	os.Exit(m.Run())
}
