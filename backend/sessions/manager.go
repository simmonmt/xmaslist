package sessions

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/util"
)

type cookieValidator struct {
	secret string
}

func (v *cookieValidator) MakeCookie(sessionID int) string {
	return fmt.Sprintf("%d:%x", sessionID, sha256.Sum256([]byte(fmt.Sprintf("%d:%s", sessionID, v.secret))))
}

func (v *cookieValidator) Validate(cookie string) (valid bool, sessionID int) {
	parts := strings.SplitN(cookie, ":", 2)
	if len(parts) != 2 {
		return false, -1
	}

	sessionID, err := strconv.Atoi(parts[0])
	if err != nil {
		return false, -1
	}

	if v.MakeCookie(sessionID) != cookie {
		return false, -1
	}

	return true, sessionID
}

type Session struct {
	ID              int
	User            *database.User
	Created, Expiry time.Time
}

type Manager struct {
	db            *database.DB
	sessionLength time.Duration
	clock         util.Clock
	validator     *cookieValidator
}

func NewManager(db *database.DB, clock util.Clock, sessionLength time.Duration, secret string) *Manager {
	return &Manager{
		db:            db,
		sessionLength: sessionLength,
		clock:         clock,
		validator: &cookieValidator{
			secret: secret,
		},
	}
}

func (sm *Manager) SessionIDFromCookie(cookie string) (bool, int) {
	return sm.validator.Validate(cookie)
}

func (sm *Manager) CreateSession(ctx context.Context, user *database.User) (cookie string, expiry time.Time, err error) {
	expiry = sm.clock.Now().Add(sm.sessionLength)
	session, err := sm.db.CreateSession(ctx, user.ID, sm.clock.Now(), expiry)
	if err != nil {
		return "", time.Time{}, err
	}

	cookie = sm.validator.MakeCookie(session.ID)
	logger.Infof("Created session for user %v, expires %v; cookie %v",
		user, expiry, cookie)

	return cookie, expiry, nil
}

// LookupActiveSession attempts to find an active session corresponding to the
// given Session ID.
//
// Returns:
//   non-nil session,   nil error       An active session was found
//     nil   session,   nil error       No active session was found
//                    non-nil error     An error occurred while looking for
//                                      a session; no determination could be
//                                      mode.
func (sm *Manager) LookupActiveSession(ctx context.Context, sessionID int) (*Session, error) {
	session, err := sm.db.LookupSession(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session lookup failure: %v", err)
	}

	if session == nil || !sm.clock.Now().Before(session.Expiry) {
		return nil, nil
	}

	user, err := sm.db.LookupUserByID(ctx, session.UserID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("failed to find user for session: %v",
			err)
	}

	return &Session{
		ID:      sessionID,
		User:    user,
		Created: session.Created,
		Expiry:  session.Expiry,
	}, nil
}

func (sm *Manager) DeactivateSession(ctx context.Context, cookie string) error {
	validSession, sessionID := sm.validator.Validate(cookie)
	if !validSession {
		return nil
	}

	return sm.db.DeleteSession(ctx, sessionID)
}
