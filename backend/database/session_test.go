package database_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
)

func TestSessions(t *testing.T) {
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a"})

	user := users.UserByUsername("a")
	created := time.Unix(1000, 0)
	expiry := time.Unix(2000, 0)

	// create session 1
	gotSess, err := db.CreateSession(ctx, user.ID, created, expiry)
	wantSess := &database.Session{
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
	wantSess = &database.Session{
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
