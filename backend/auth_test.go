package main

import (
	"context"
	"net/http"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
)

func TestAuthorize(t *testing.T) {
	ctx := context.Background()
	clock := &util.MonoClock{Time: time.Unix(1000, 0)}
	db := testutil.SetupTestDatabase(ctx, t)
	defer db.Close()
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a", "b"})

	manager := sessions.NewManager(db, clock, time.Hour, "secret")
	cookie, _, err := manager.CreateSession(ctx, users.UserByUsername("a"))
	if err != nil {
		t.Fatal(err)
	}

	// A session signed with a different secret (as after the secret is
	// rotated). It's for another user because each user has at most one
	// session.
	otherManager := sessions.NewManager(db, clock, time.Hour, "other")
	otherCookie, _, err := otherManager.CreateSession(ctx, users.UserByUsername("b"))
	if err != nil {
		t.Fatal(err)
	}

	ai := &AuthInterceptor{sessionManager: manager}

	session, err := ai.authorize(ctx, http.Header{"Authorization": {cookie}})
	if err != nil || session == nil || session.User.Username != "a" {
		t.Errorf("authorize(valid cookie) = %+v, %v, want session for a",
			session, err)
	}

	for name, header := range map[string]http.Header{
		"no cookie":      {},
		"garbage cookie": {"Authorization": {"garbage"}},
		"other secret":   {"Authorization": {otherCookie}},
		"bad signature":  {"Authorization": {cookie + "0"}},
	} {
		if _, err := ai.authorize(ctx, header); connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Errorf("authorize(%s) = _, %v, want Unauthenticated",
				name, err)
		}
	}

	if err := manager.DeactivateSession(ctx, cookie); err != nil {
		t.Fatal(err)
	}
	if _, err := ai.authorize(ctx, http.Header{"Authorization": {cookie}}); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("authorize(logged out cookie) = _, %v, want Unauthenticated",
			err)
	}
}
