package userservice

import (
	"context"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/request"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	uspb "github.com/simmonmt/xmaslist/proto/user_service"
)

type userServer struct {
	uspb.UnimplementedUserServiceServer

	clock util.Clock
	db    *database.DB
}

func getSession(ctx context.Context) (*sessions.Session, error) {
	val := ctx.Value(request.SessionKey)
	if val == nil {
		return nil, status.Errorf(codes.Internal, "missing session")
	}

	return val.(*sessions.Session), nil
}

func (s *userServer) GetUsers(ctx context.Context, req *uspb.GetUsersRequest) (*uspb.GetUsersResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	resp := &uspb.GetUsersResponse{}

	return resp, nil
}

func RegisterHandlers(server *grpc.Server, clock util.Clock, db *database.DB) {
	handlers := &userServer{
		clock: clock,
		db:    db,
	}

	uspb.RegisterUserServiceServer(server, handlers)
}
