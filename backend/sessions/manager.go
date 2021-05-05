package sessions

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
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

func (sm *Manager) CreateSession(ctx context.Context, user *database.User) (cookie string, expiry time.Time, err error) {
	expiry = sm.clock.Now().Add(sm.sessionLength)
	session, err := sm.db.CreateSession(ctx, user.ID, sm.clock.Now(), expiry)
	if err != nil {
		return "", time.Time{}, err
	}

	cookie = sm.validator.MakeCookie(session.ID)
	return cookie, expiry, nil
}

func (sm *Manager) SessionIsActive(ctx context.Context, cookie string) (bool, error) {
	validSession, sessionID := sm.validator.Validate(cookie)
	if !validSession {
		return false, nil
	}

	session, err := sm.db.LookupSession(ctx, sessionID)
	if err != nil {
		log.Printf("validateUser session lookup failure: %v", err)
		return false, err
	}

	if session == nil {
		return false, nil
	}

	return sm.clock.Now().Before(session.Expiry), nil
}

func (sm *Manager) DeactivateSession(ctx context.Context, cookie string) error {
	validSession, sessionID := sm.validator.Validate(cookie)
	if !validSession {
		return nil
	}

	return sm.db.DeleteSession(ctx, sessionID)
}
