package listservice

import (
	"context"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/testing/protocmp"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/dbutil"
	"github.com/simmonmt/xmaslist/backend/database/testutil"
	"github.com/simmonmt/xmaslist/backend/request"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"

	lspb "github.com/simmonmt/xmaslist/proto/list_service"
)

var (
	ctx = context.Background()
)

func makeListServer(clock util.Clock, sessionManager *sessions.Manager, db *database.DB) *listServer {
	return &listServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}
}

// Create sessions for all users
func makeSessions(t *testing.T, clock util.Clock, db *database.DB, userResps testutil.UserSetupResponses) (sm *sessions.Manager, sessionsByUserID map[int]*sessions.Session) {
	sm = sessions.NewManager(db, clock, time.Duration(999)*time.Hour, "secret")
	sessionsByUserID = map[int]*sessions.Session{}

	for _, resp := range userResps {
		cookie, _, err := sm.CreateSession(ctx, resp.User)
		if err != nil {
			t.Fatalf("failed to create user %v: %v",
				resp.User.ID, err)
		}

		validSession, sessionID := sm.SessionIDFromCookie(cookie)
		if !validSession {
			t.Fatalf("failed to get session ID for user %v",
				resp.User.ID)
		}

		session, err := sm.LookupActiveSession(ctx, sessionID)
		if err != nil {
			t.Fatalf("failed to find session %v for %v: %v",
				sessionID, resp.User.ID, err)
		}

		sessionsByUserID[resp.User.ID] = session
	}

	return
}

type updateListItemTestState struct {
	Clock            *util.MonoClock
	DB               *database.DB
	Users            testutil.UserSetupResponses
	Lists            testutil.ListSetupResponses
	SessionsByUserID map[int]*sessions.Session
	Server           *listServer
}

func setupListItemTestState(ctx context.Context, t *testing.T) *updateListItemTestState {
	clock := &util.MonoClock{Time: time.Unix(0, 0)}
	db := testutil.SetupTestDatabase(ctx, t)
	users := testutil.CreateTestUsers(ctx, t, db, []string{"a", "b"})
	sm, sessionsByUserID := makeSessions(t, clock, db, users)

	reqs := []*testutil.ListSetupRequest{
		&testutil.ListSetupRequest{
			Owner: "a",
			List: &database.ListData{Name: "l1", Beneficiary: "b1",
				EventDate: time.Unix(1, 0), Active: true},
			ListItems: []*database.ListItemData{
				&database.ListItemData{
					Name: "l1i1", Desc: "l1i1desc",
					URL: "l1i1url",
				},
				&database.ListItemData{
					Name: "l1i2", Desc: "l1i2desc",
					URL: "l1i2url",
				},
			},
		},
	}

	return &updateListItemTestState{
		Clock:            clock,
		DB:               db,
		Users:            users,
		Lists:            testutil.SetupLists(ctx, t, db, reqs),
		SessionsByUserID: sessionsByUserID,
		Server:           makeListServer(clock, sm, db),
	}
}

func TestUpdateListItem_NonOwnerDataUpdate(t *testing.T) {
	state := setupListItemTestState(ctx, t)
	defer state.DB.Close()

	list, item := state.Lists.GetItem("l1", "l1i2")

	var nonOwner *database.User
	for _, userResp := range state.Users {
		if userResp.User.ID != list.OwnerID {
			nonOwner = userResp.User
			break
		}
	}
	if nonOwner == nil {
		t.Fatalf("bad test state -- no non-owner")
	}
	nonOwnerSession := state.SessionsByUserID[nonOwner.ID]
	reqCtx := context.WithValue(ctx, request.SessionKey, nonOwnerSession)

	req := &lspb.UpdateListItemRequest{
		ListId:      strconv.Itoa(list.ID),
		ItemId:      strconv.Itoa(item.ID),
		ItemVersion: int32(item.Version),

		Data: &lspb.ListItemData{Name: "name"},
	}

	resp, err := state.Server.UpdateListItem(reqCtx, req)
	if err == nil || status.Code(err) != codes.PermissionDenied {
		t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, want _, PermissionDenied",
			req, resp, err)
	}
}

func TestUpdateListItem(t *testing.T) {
	state := setupListItemTestState(ctx, t)
	defer state.DB.Close()

	list, item := state.Lists.GetItem("l1", "l1i2")

	user := state.Users.UserByID(list.OwnerID)
	session := state.SessionsByUserID[user.ID]
	reqCtx := context.WithValue(ctx, request.SessionKey, session)

	// Try to update data without an item name. This should fail, as name is
	// required.

	req := &lspb.UpdateListItemRequest{
		ListId:      strconv.Itoa(list.ID),
		ItemId:      strconv.Itoa(item.ID),
		ItemVersion: int32(item.Version),

		Data: &lspb.ListItemData{},
	}

	resp, err := state.Server.UpdateListItem(reqCtx, req)
	if err == nil || status.Code(err) != codes.InvalidArgument {
		t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, want _, InvalidArgument",
			req, resp, err)
	}

	// Try to update data with a name but no desc or url. This should
	// succeed, as only name is required.

	req.Data = &lspb.ListItemData{
		Name: "name",
	}

	wantResp := &lspb.UpdateListItemResponse{
		Item: &lspb.ListItem{
			Id:      req.GetItemId(),
			Version: req.GetItemVersion() + 1,
			ListId:  req.GetListId(),

			Data: &lspb.ListItemData{
				Name: "name",
				Desc: "",
				Url:  "",
			},

			State: &lspb.ListItemState{},

			Metadata: &lspb.ListItemMetadata{
				Created: item.Created.Unix(),
				Updated: state.Clock.Time.Unix(),
			},
		},
	}

	resp, err = state.Server.UpdateListItem(reqCtx, req)
	if err != nil {
		t.Fatalf("UpdateListItem(_, %+v) = %v, %v, want %v, nil",
			req, resp, err, wantResp)
	}

	if diff := cmp.Diff(resp, wantResp, protocmp.Transform()); diff != "" {
		t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, unexpected difference:\n%v", req, resp, err, diff)
	}

	// Try it again with full data as well as state. This should succeed.

	req.ItemVersion = resp.GetItem().GetVersion()
	req.Data = &lspb.ListItemData{
		Name: "name",
		Desc: "desc",
		Url:  "url",
	}
	req.State = &lspb.ListItemState{
		Claimed: true,
	}

	wantResp.Item.Version = req.ItemVersion + 1
	wantResp.Item.Data = req.Data
	wantResp.Item.State.Claimed = true
	wantResp.Item.Metadata = &lspb.ListItemMetadata{
		Created:     wantResp.Item.Metadata.Created,
		Updated:     state.Clock.Time.Unix(),
		ClaimedBy:   int32(user.ID),
		ClaimedWhen: state.Clock.Time.Unix(),
	}

	resp, err = state.Server.UpdateListItem(reqCtx, req)
	if err != nil {
		t.Fatalf("UpdateListItem(_, %+v) = %v, %v, want %v, nil",
			req, resp, err, wantResp)
	}

	if diff := cmp.Diff(resp, wantResp, protocmp.Transform()); diff != "" {
		t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, unexpected difference:\n%v", req, resp, err, diff)
	}
}

func TestUpdateListItem_Claim(t *testing.T) {
	state := setupListItemTestState(ctx, t)
	defer state.DB.Close()

	list, origItem := state.Lists.GetItem("l1", "l1i2")

	// Iterate through both users to verify that both the list owner and the
	// non-owner can claim and unclaim.
	for _, userResp := range state.Users {
		t.Run(userResp.User.Username, func(t *testing.T) {
			// Re-read the item because the version will have
			// changed from the listResp version on the 2nd and
			// subsequent loop iterations.
			item, err := dbutil.GetListItem(ctx, state.DB, list.ID,
				origItem.ID)
			if err != nil {
				t.Fatalf("failed to read item %v/%v", list.ID,
					origItem.ID)
			}

			claimUser := userResp.User
			claimSession := state.SessionsByUserID[claimUser.ID]

			reqCtx := context.WithValue(ctx, request.SessionKey,
				claimSession)

			// Try to unclaim an already-unclaimed item. This should
			// fail.

			req := &lspb.UpdateListItemRequest{
				ListId:      strconv.Itoa(list.ID),
				ItemId:      strconv.Itoa(item.ID),
				ItemVersion: int32(item.Version),

				State: &lspb.ListItemState{
					Claimed: false,
				},
			}

			resp, err := state.Server.UpdateListItem(reqCtx, req)
			if err == nil || status.Code(err) != codes.FailedPrecondition || !strings.Contains(err.Error(), "isn't claimed") {
				t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, want _, FailedPrecondition",
					req, resp, err)
			}

			// Try to claim an unclaimed item. This should succeed.

			req.GetState().Claimed = true
			claimedWhen := state.Clock.Time

			wantResp := &lspb.UpdateListItemResponse{
				Item: &lspb.ListItem{
					Id:      req.GetItemId(),
					Version: req.GetItemVersion() + 1,
					ListId:  req.GetListId(),

					Data: &lspb.ListItemData{
						Name: "l1i2",
						Desc: "l1i2desc",
						Url:  "l1i2url",
					},

					State: &lspb.ListItemState{Claimed: true},

					Metadata: &lspb.ListItemMetadata{
						Created:     item.Created.Unix(),
						Updated:     claimedWhen.Unix(),
						ClaimedBy:   int32(claimUser.ID),
						ClaimedWhen: claimedWhen.Unix(),
					},
				},
			}

			resp, err = state.Server.UpdateListItem(reqCtx, req)
			if err != nil {
				t.Fatalf("UpdateListItem(_, %+v) = %v, %v, want %v, nil",
					req, resp, err, wantResp)
			}

			if diff := cmp.Diff(resp, wantResp, protocmp.Transform()); diff != "" {
				t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, unexpected difference:\n%v", req, resp, err, diff)
			}

			// Try the claim again, but without updating the version
			// token. This should fail because of the token mismatch.

			_, err = state.Server.UpdateListItem(reqCtx, req)
			if err == nil || status.Code(err) != codes.FailedPrecondition || !strings.Contains(err.Error(), "version ID mismatch") {
				t.Fatalf("UpdateListItem(_, %+v) = _, %v, want _, FailedPrecondition",
					req, err)
			}

			// Try the claim again, this time using the token we got
			// back from the successful claim. This should fail
			// because the item is already claimed.

			req.ItemVersion = resp.GetItem().GetVersion()
			resp, err = state.Server.UpdateListItem(reqCtx, req)
			if err == nil || status.Code(err) != codes.FailedPrecondition || !strings.Contains(err.Error(), "already claimed") {
				t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, want _, FailedPrecondition",
					req, resp, err)
			}

			// Try to unclaim the item. We continue to use the
			// version token from the successful claim. This should
			// succeed.

			req.GetState().Claimed = false
			wantResp.GetItem().Version++
			wantResp.GetItem().GetState().Claimed = false
			wantResp.GetItem().GetMetadata().ClaimedBy = 0
			wantResp.GetItem().GetMetadata().ClaimedWhen = 0
			wantResp.GetItem().GetMetadata().Updated =
				state.Clock.Time.Unix()

			resp, err = state.Server.UpdateListItem(reqCtx, req)
			if err != nil {
				t.Fatalf("UpdateListItem(_, %+v) = _, %v, want _, nil",
					req, resp, err, wantResp)
			}

			if diff := cmp.Diff(resp, wantResp, protocmp.Transform()); diff != "" {
				t.Fatalf("UpdateListItem(_, %+v) = %+v, %v, unexpected difference:\n%v", req, resp, err, diff)
			}
		})
	}
}

// Verify that only the claimed-by user can unclaim
func TestUpdateListItem_UnclaimWithCrossOwnership(t *testing.T) {
	state := setupListItemTestState(ctx, t)
	defer state.DB.Close()

	list, item := state.Lists.GetItem("l1", "l1i2")

	makeRequestContext := func(ctx context.Context, username string) context.Context {
		user := state.Users.UserByUsername(username)
		session := state.SessionsByUserID[user.ID]
		return context.WithValue(ctx, request.SessionKey, session)
	}

	reqCtxA := makeRequestContext(ctx, "a")
	reqCtxB := makeRequestContext(ctx, "b")

	req := &lspb.UpdateListItemRequest{
		ListId:      strconv.Itoa(list.ID),
		ItemId:      strconv.Itoa(item.ID),
		ItemVersion: int32(item.Version),
		State:       &lspb.ListItemState{Claimed: true},
	}

	resp, err := state.Server.UpdateListItem(reqCtxA, req)
	if err != nil {
		t.Fatalf("failed to claim")
	}

	req.ItemVersion = resp.GetItem().GetVersion()
	req.GetState().Claimed = false

	_, err = state.Server.UpdateListItem(reqCtxB, req)
	if err == nil || status.Code(err) != codes.PermissionDenied {
		t.Fatalf("UpdateListItem(_, %+v) = _, %v, want _, PermissionDenied",
			req, err)
	}

}
