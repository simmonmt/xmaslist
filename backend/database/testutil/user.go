package testutil

import (
	"context"
	"fmt"
	"testing"
	"unicode"
	"unicode/utf8"

	"github.com/simmonmt/xmaslist/backend/database"
)

type UserSetupRequest struct {
	Username string
	Fullname string
	Password string
	Admin    bool
}

type UserSetupResponse struct {
	User     *database.User
	Password string
}

type UserSetupResponses []*UserSetupResponse

func (a UserSetupResponses) UserByID(id int) *database.User {
	for _, r := range a {
		if r.User.ID == id {
			return r.User
		}
	}
	return nil
}

func (a UserSetupResponses) PasswordByID(id int) string {
	for _, r := range a {
		if r.User.ID == id {
			return r.Password
		}
	}
	panic("bad uid")
}

func (a UserSetupResponses) UserByUsername(username string) *database.User {
	for _, r := range a {
		if r.User.Username == username {
			return r.User
		}
	}
	return nil
}

func SetupUsers(ctx context.Context, t *testing.T, db *database.DB, reqs []*UserSetupRequest) UserSetupResponses {
	resps := []*UserSetupResponse{}

	for _, req := range reqs {
		user := &database.User{
			Username: req.Username,
			Fullname: req.Fullname,
			Admin:    req.Admin,
		}

		userID, err := db.CreateUser(ctx, user, req.Password)
		if err != nil {
			t.Fatalf("CreateUser(_, %v, %v) = _, %v, want _, nil", user, req.Password, err)
		}

		user.ID = userID
		resps = append(resps, &UserSetupResponse{
			User:     user,
			Password: req.Password,
		})
	}

	return resps
}

func CreateTestUsers(ctx context.Context, t *testing.T, db *database.DB, usernames []string) UserSetupResponses {
	reqs := []*UserSetupRequest{}
	for _, username := range usernames {
		r, _ := utf8.DecodeRuneInString(username)
		isAdmin := unicode.IsUpper(r)

		reqs = append(reqs, &UserSetupRequest{
			Username: username,
			Fullname: fmt.Sprintf("User %v", username),
			Password: username + username,
			Admin:    isAdmin,
		})
	}

	return SetupUsers(ctx, t, db, reqs)
}
