package userservice

import (
	"context"
	"errors"
	"net/http"

	"connectrpc.com/connect"
	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/request"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"

	uspb "github.com/simmonmt/xmaslist/proto/user_service"
	"github.com/simmonmt/xmaslist/proto/user_service/user_serviceconnect"
)

type userServer struct {
	user_serviceconnect.UnimplementedUserServiceHandler

	clock util.Clock
	db    *database.DB
}

func getSession(ctx context.Context) (*sessions.Session, error) {
	val := ctx.Value(request.SessionKey)
	if val == nil {
		return nil, connect.NewError(connect.CodeInternal,
			errors.New("missing session"))
	}

	return val.(*sessions.Session), nil
}

func (s *userServer) GetUsers(ctx context.Context, connectReq *connect.Request[uspb.GetUsersRequest]) (*connect.Response[uspb.GetUsersResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	resp := &uspb.GetUsersResponse{}
	for _, id := range req.GetIds() {
		user, err := s.db.LookupUserByID(ctx, int(id))
		if err != nil {
			return nil, err
		}
		if user != nil {
			resp.Users = append(resp.Users,
				util.UserInfoFromDatabaseUser(user))
		}
	}

	return connect.NewResponse(resp), nil
}

func RegisterHandlers(mux *http.ServeMux, clock util.Clock, db *database.DB, opts ...connect.HandlerOption) {
	handlers := &userServer{
		clock: clock,
		db:    db,
	}

	mux.Handle(user_serviceconnect.NewUserServiceHandler(handlers, opts...))
}
