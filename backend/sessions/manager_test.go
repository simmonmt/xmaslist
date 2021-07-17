package sessions_test

import (
	"context"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
)

var (
	ctx    = context.Background()
	secret = "secret"
)

type TestState struct {
	Clock *util.MonoClock
	DB    *database.DB
	Users testutil.UserSetupResponses
}

func setupState(ctx context.Context, t *testing.T) *TestState {
	// Create a clock that starts at non-zero to flush out any accidental
	// uses of zero.
	clock := &util.MonoClock{
		Time: time.Unix(0, 0).Add(time.Duration(30) * time.Minute),
	}

	db := testutil.SetupTestDatabase(ctx, t)
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a", "b"})

	return &TestState{
		Clock: clock,
		DB:    db,
		Users: users,
	}
}

func parseCookie(cookie string) (int, string, error) {
	parts := strings.SplitN(cookie, ":", 2)
	id, err := strconv.Atoi(parts[0])
	return id, parts[1], err
}

func TestSessionIDFromCookie(t *testing.T) {
	testState := setupState(ctx, t)
	defer testState.DB.Close()

	user := testState.Users.UserByUsername("a")
	sessionLength := time.Duration(1) * time.Hour
	manager := sessions.NewManager(testState.DB, testState.Clock, sessionLength, secret)

	cookie, _, err := manager.CreateSession(ctx, user)
	if err != nil || cookie == "" {
		t.Fatalf(`CreateSession(_, %v) = %v, _, %v, want non-"", _, nil`,
			user, cookie, err)
	}

	wantSessionID, hash, err := parseCookie(cookie)
	if err != nil {
		t.Fatalf("failed to parse session cookie %v: %v", cookie, err)
	}

	if hash == "" {
		t.Fatalf("cookie %v has empty hash", cookie)
	}

	if ok, sessionID := manager.SessionIDFromCookie(cookie); !ok || sessionID <= 0 || wantSessionID != sessionID {
		t.Fatalf(`SessionIDFromCookie(%v) = %v, %v; want true, %v`,
			cookie, ok, wantSessionID)
	}

	badCookie := cookie + "bad"
	if ok, sessionID := manager.SessionIDFromCookie(badCookie); ok {
		t.Fatalf(`SessionIDFromCookie(%v) = %v, %v; want false, _`,
			badCookie, ok, sessionID)
	}
}

func TestCreateSession_Expiration(t *testing.T) {
	testState := setupState(ctx, t)
	defer testState.DB.Close()

	user := testState.Users.UserByUsername("a")
	sessionLength := time.Duration(1) * time.Hour
	manager := sessions.NewManager(testState.DB, testState.Clock, sessionLength, secret)

	wantExpiry := testState.Clock.Time.Add(sessionLength)
	cookie, expiry, err := manager.CreateSession(ctx, user)
	if err != nil || expiry != wantExpiry || cookie == "" {
		t.Fatalf(`CreateSession(_, %v) = %v, %v, %v, want non-"", %v, nil`,
			user, cookie, expiry, err, wantExpiry)
	}

	ok, sessionID := manager.SessionIDFromCookie(cookie)
	if !ok {
		t.Fatalf("SessionIDFromCookie(%v) = false, %v", cookie, sessionID)
	}

	results := []bool{}
	for i := -3; i <= 3; i++ {
		now := wantExpiry.Add(time.Duration(i) * time.Second)
		testState.Clock.Time = now

		session, err := manager.LookupActiveSession(ctx, sessionID)
		if err != nil {
			t.Fatalf("now=%v, i=%v, LookupActiveSession(_, %v) = %v, %v; want _, nil",
				now, i, sessionID, session, err)
		}

		results = append(results, session != nil)
	}

	// Sessions are only valid before their expiration time.
	//
	//             e-3s  e-2s  e-1s  exp    e+1s   e+2s   e+3s
	want := []bool{true, true, true, false, false, false, false}
	if !reflect.DeepEqual(results, want) {
		t.Fatalf("results = %v; want %v", results, want)
	}
}

func TestCreateSession_MultipleUsers(t *testing.T) {
	testState := setupState(ctx, t)
	defer testState.DB.Close()

	userA := testState.Users.UserByUsername("a")
	userB := testState.Users.UserByUsername("b")
	sessionLength := time.Duration(1) * time.Hour
	manager := sessions.NewManager(testState.DB, testState.Clock,
		sessionLength, secret)

	wantExpiryA := testState.Clock.Time.Add(sessionLength)
	cookieA, expiryA, err := manager.CreateSession(ctx, userA)
	if err != nil || expiryA != wantExpiryA {
		t.Fatalf("CreateSession A = _, %v, %v, want _, %v, nil",
			cookieA, expiryA, wantExpiryA, err)
	}

	// Advance the clock so we're not creating B's session at the same time
	// as A. (The fake clock we're using will also guarantee this because of
	// how its Now() is implemented, but this explicit Advance call makes it
	// clearer).
	testState.Clock.Advance(time.Duration(5) * time.Minute)

	wantExpiryB := testState.Clock.Time.Add(sessionLength)
	cookieB, expiryB, err := manager.CreateSession(ctx, userB)
	if err != nil || expiryB != wantExpiryB {
		t.Fatalf("CreateSession B = _, %v, %v, want _, %v, nil",
			cookieB, expiryB, wantExpiryB, err)
	}

	sessionIDA, _, err := parseCookie(cookieA)
	if err != nil {
		t.Fatalf("failed to parse cookie %v: %v", cookieA, err)
	}
	sessionIDB, _, err := parseCookie(cookieB)
	if err != nil {
		t.Fatalf("failed to parse cookie %v: %v", cookieB, err)
	}

	if sessionIDA == sessionIDB {
		t.Fatalf("session IDs collide %v == %v", sessionIDA, sessionIDB)
	}

	// The expiration times shouldn't match because we made sure to create
	// the sessions at different times (see the testState.Clock.Advance call
	// above)
	if expiryA == expiryB {
		t.Fatalf("expirys collide %v == %v", expiryA, expiryB)
	}
}

// Create two sessions for the same user. The second should invalidate the first.
func TestCreateSession_Recreate(t *testing.T) {
	testState := setupState(ctx, t)
	defer testState.DB.Close()

	user := testState.Users.UserByUsername("a")
	sessionLength := time.Duration(1) * time.Hour
	manager := sessions.NewManager(testState.DB, testState.Clock,
		sessionLength, secret)

	cookie1, expiry1, err := manager.CreateSession(ctx, user)
	if err != nil {
		t.Fatalf("CreateSession 1 = %v, %v, %v, want _, _, nil",
			cookie1, expiry1, err)
	}

	ok, sessionID1 := manager.SessionIDFromCookie(cookie1)
	if !ok {
		t.Fatalf("SessionIDFromCookie %v = %v, _, want true", cookie1, ok)
	}

	if session, err := manager.LookupActiveSession(ctx, sessionID1); err != nil || session == nil {
		t.Fatalf("LookupActiveSession(_, session 1) = %v, %v, want non-nil, nil",
			session, err)
	}

	// Create a second session for the same user
	cookie2, expiry2, err := manager.CreateSession(ctx, user)
	if err != nil {
		t.Fatalf("CreateSession 2 = %v, %v, %v, want _, _, nil",
			cookie2, expiry2, err)
	}

	ok, sessionID2 := manager.SessionIDFromCookie(cookie2)
	if !ok {
		t.Fatalf("SessionIDFromCookie %v = %v, _, want true", cookie2, ok)
	}

	if sessionID1 == sessionID2 {
		t.Fatalf("session ID reuse %v == %v", sessionID1, sessionID2)
	}

	if !expiry1.Before(expiry2) {
		t.Fatalf("expiry1 %v not before expiry2 %v", expiry1, expiry2)
	}

	checkTime := testState.Clock.Time
	if session, err := manager.LookupActiveSession(ctx, sessionID1); err != nil || session != nil {
		t.Fatalf("LookupActiveSession(_, session 1) = %v, %v, want nil, nil",
			session, err)
	}

	// Our test clock will advance with each lookup, so reset it to minimize
	// change between these two calls.
	testState.Clock.Time = checkTime
	if session, err := manager.LookupActiveSession(ctx, sessionID2); err != nil {
		t.Fatalf("LookupActiveSession(_, session 2) = %v, %v, want _, nil",
			session, err)
	}
}

func TestDeactivateSession(t *testing.T) {
	testState := setupState(ctx, t)
	defer testState.DB.Close()

	user := testState.Users.UserByUsername("a")
	sessionLength := time.Duration(1) * time.Hour
	manager := sessions.NewManager(testState.DB, testState.Clock,
		sessionLength, secret)

	cookie, _, err := manager.CreateSession(ctx, user)
	if err != nil {
		t.Fatalf("CreateSession = %v, _, %v, want _, _, nil",
			cookie, err)
	}

	ok, sessionID := manager.SessionIDFromCookie(cookie)
	if !ok {
		t.Fatalf("SessionIDFromCookie %v = %v, _, want true", cookie, ok)
	}

	if session, err := manager.LookupActiveSession(ctx, sessionID); err != nil || session == nil {
		t.Fatalf("LookupActiveSession(_, %v) = %v, %v, want non-nil, nil",
			sessionID, session, err)
	}

	if err := manager.DeactivateSession(ctx, cookie); err != nil {
		t.Fatalf("DeactivateSession(%v) = %v, want nil", cookie, err)
	}

	if session, err := manager.LookupActiveSession(ctx, sessionID); err != nil || session != nil {
		t.Fatalf("LookupActiveSession(_, %v) = %v, %v, want nil, nil",
			sessionID, session, err)
	}

	// It's not an error to deactivate an inactive session
	if err := manager.DeactivateSession(ctx, cookie); err != nil {
		t.Fatalf("DeactivateSession(%v) = %v, want nil", cookie, err)
	}
}
