package listservice

import (
	"context"
	"fmt"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
	"google.golang.org/grpc"

	lspb "github.com/simmonmt/xmaslist/proto/list_service"
)

type listServer struct {
	clock          util.Clock
	sessionManager *sessions.Manager
	db             *database.DB
}

func (s *listServer) GetLists(ctx context.Context, req *lspb.GetListsRequest) (*lspb.GetListsResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *listServer) NewList(ctx context.Context, req *lspb.NewListRequest) (*lspb.NewListResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *listServer) DeleteList(ctx context.Context, req *lspb.DeleteListRequest) (*lspb.DeleteListResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *listServer) UpdateList(ctx context.Context, req *lspb.UpdateListRequest) (*lspb.UpdateListResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *listServer) GetListItems(ctx context.Context, req *lspb.GetListItemsRequest) (*lspb.GetListItemsResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *listServer) AddListItem(ctx context.Context, req *lspb.AddListItemRequest) (*lspb.AddListItemResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *listServer) DeleteListItem(ctx context.Context, req *lspb.DeleteListItemRequest) (*lspb.DeleteListItemResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *listServer) UpdateListItem(ctx context.Context, req *lspb.UpdateListItemRequest) (*lspb.UpdateListItemResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func RegisterHandlers(server *grpc.Server, clock util.Clock, sessionManager *sessions.Manager, db *database.DB) {
	handlers := &listServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}

	lspb.RegisterListServiceServer(server, handlers)
}
