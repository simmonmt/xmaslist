package authservice

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"connectrpc.com/connect"
	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"

	aspb "github.com/simmonmt/xmaslist/proto/auth_service"
	"github.com/simmonmt/xmaslist/proto/auth_service/auth_serviceconnect"
)

type userServer struct {
	auth_serviceconnect.UnimplementedAuthServiceHandler

	clock          util.Clock
	sessionManager *sessions.Manager
	db             *database.DB
}

func (s *userServer) Login(ctx context.Context, connectReq *connect.Request[aspb.LoginRequest]) (*connect.Response[aspb.LoginResponse], error) {
	req := connectReq.Msg
	if req.GetUsername() == "" || req.GetPassword() == "" {
		return nil, fmt.Errorf("missing username or password")
	}

	userID, err := s.db.AuthenticateUser(
		ctx, req.GetUsername(), req.GetPassword())
	if err != nil {
		return nil, err
	}

	user, err := s.db.LookupUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		// AuthenticateUser just found this user, so it must have been
		// deleted out from under us. That's a server-side
		// inconsistency rather than bad credentials.
		return nil, connect.NewError(connect.CodeInternal,
			fmt.Errorf("authenticated user %v not found", userID))
	}

	cookie, expiry, err := s.sessionManager.CreateSession(ctx, user)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&aspb.LoginResponse{
		Cookie:   cookie,
		Expiry:   expiry.Unix(),
		UserInfo: util.UserInfoFromDatabaseUser(user),
	}), nil
}

func (s *userServer) Logout(ctx context.Context, connectReq *connect.Request[aspb.LogoutRequest]) (*connect.Response[aspb.LogoutResponse], error) {
	req := connectReq.Msg
	if req.GetCookie() == "" {
		return nil, fmt.Errorf("missing cookie in request")
	}

	if err := s.sessionManager.DeactivateSession(ctx, req.GetCookie()); err != nil {
		log.Printf("logout failure: %v", err)
	}

	return connect.NewResponse(&aspb.LogoutResponse{}), nil
}

func RegisterHandlers(mux *http.ServeMux, clock util.Clock, sessionManager *sessions.Manager, db *database.DB, opts ...connect.HandlerOption) {
	handlers := &userServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}

	mux.Handle(auth_serviceconnect.NewAuthServiceHandler(handlers, opts...))
}
