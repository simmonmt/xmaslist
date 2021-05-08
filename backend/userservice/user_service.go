package userservice

import (
	"context"
	"fmt"
	"log"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
	"google.golang.org/grpc"

	uspb "github.com/simmonmt/xmaslist/proto/user_service"
)

type userServer struct {
	clock          util.Clock
	sessionManager *sessions.Manager
	db             *database.DB
}

func userInfoFromDatabaseUser(dbUser *database.User) *uspb.UserInfo {
	return &uspb.UserInfo{
		Username: dbUser.Username,
		Fullname: dbUser.Fullname,
		IsAdmin:  dbUser.Admin,
	}
}

func (s *userServer) Login(ctx context.Context, req *uspb.LoginRequest) (*uspb.LoginResponse, error) {
	if req.GetUsername() == "" || req.GetPassword() == "" {
		return nil, fmt.Errorf("missing username or password")
	}

	userID, err := s.db.AuthenticateUser(
		ctx, req.GetUsername(), req.GetPassword())
	if err != nil {
		return nil, err
	}

	user, err := s.db.LookupUser(ctx, userID)

	cookie, expiry, err := s.sessionManager.CreateSession(ctx, user)
	if err != nil {
		return nil, err
	}

	return &uspb.LoginResponse{
		Success:  true,
		Cookie:   cookie,
		Expiry:   expiry.Unix(),
		UserInfo: userInfoFromDatabaseUser(user),
	}, nil
}

func (s *userServer) Logout(ctx context.Context, req *uspb.LogoutRequest) (*uspb.LogoutResponse, error) {
	if req.GetCookie() == "" {
		return nil, fmt.Errorf("missing cookie in request")
	}

	if err := s.sessionManager.DeactivateSession(ctx, req.GetCookie()); err != nil {
		log.Printf("logout failure: %v", err)
	}

	return &uspb.LogoutResponse{}, nil
}

func RegisterHandlers(server *grpc.Server, clock util.Clock, sessionManager *sessions.Manager, db *database.DB) {
	handlers := &userServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}

	uspb.RegisterUserServiceServer(server, handlers)
}
