package listservice

import (
	"context"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/request"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	lspb "github.com/simmonmt/xmaslist/proto/list_service"
)

type listServer struct {
	lspb.UnimplementedListServiceServer

	clock          util.Clock
	sessionManager *sessions.Manager
	db             *database.DB
}

func getSession(ctx context.Context) (*sessions.Session, error) {
	val := ctx.Value(request.SessionKey)
	if val == nil {
		return nil, status.Errorf(codes.Internal, "missing session")
	}

	return val.(*sessions.Session), nil
}

func (s *listServer) ListLists(ctx context.Context, req *lspb.ListListsRequest) (*lspb.ListListsResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func (s *listServer) CreateList(ctx context.Context, req *lspb.CreateListRequest) (*lspb.CreateListResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func (s *listServer) DeactivateList(ctx context.Context, req *lspb.DeactivateListRequest) (*lspb.DeactivateListResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func (s *listServer) UpdateList(ctx context.Context, req *lspb.UpdateListRequest) (*lspb.UpdateListResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func (s *listServer) ListListItems(ctx context.Context, req *lspb.ListListItemsRequest) (*lspb.ListListItemsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func (s *listServer) CreateListItem(ctx context.Context, req *lspb.CreateListItemRequest) (*lspb.CreateListItemResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func (s *listServer) DeleteListItem(ctx context.Context, req *lspb.DeleteListItemRequest) (*lspb.DeleteListItemResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func (s *listServer) UpdateListItem(ctx context.Context, req *lspb.UpdateListItemRequest) (*lspb.UpdateListItemResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "not implemented")
}

func RegisterHandlers(server *grpc.Server, clock util.Clock, sessionManager *sessions.Manager, db *database.DB) {
	handlers := &listServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}

	lspb.RegisterListServiceServer(server, handlers)
}
