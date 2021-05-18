package listservice

import (
	"context"
	"strconv"
	"time"

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

func listFromDatabaseList(list *database.List) *lspb.List {
	return &lspb.List{
		Id:      strconv.Itoa(list.ID),
		Version: int32(list.Version),

		Data: &lspb.ListData{
			Name:        list.Name,
			Beneficiary: list.Beneficiary,
			EventDate:   list.EventDate.Unix(),
		},

		Metadata: &lspb.ListMetadata{
			Created: list.Created.Unix(),
			Updated: list.Updated.Unix(),
			Owner:   int32(list.OwnerID),
			Active:  list.Active,
		},
	}
}

func (s *listServer) ListLists(ctx context.Context, req *lspb.ListListsRequest) (*lspb.ListListsResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	lists, err := s.db.ListLists(ctx, database.IncludeInactiveLists(
		req.GetIncludeInactive()))
	if err != nil {
		return nil, err
	}

	resp := &lspb.ListListsResponse{}
	for _, list := range lists {
		resp.Lists = append(resp.Lists, listFromDatabaseList(list))
	}

	return resp, nil
}

func (s *listServer) GetList(ctx context.Context, req *lspb.GetListRequest) (*lspb.GetListResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil {
		return nil, status.Errorf(codes.InvalidArgument,
			"invalid list id")
	}

	lists, err := s.db.ListLists(ctx, database.OnlyListWithID(listID))
	if err != nil {
		return nil, err
	}

	if len(lists) == 0 {
		return nil, status.Errorf(codes.NotFound,
			"no list with id %v", listID)
	}

	return &lspb.GetListResponse{
		List: listFromDatabaseList(lists[0]),
	}, nil
}

func (s *listServer) CreateList(ctx context.Context, req *lspb.CreateListRequest) (*lspb.CreateListResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	pbData := req.GetData()
	if pbData.GetName() == "" || pbData.GetBeneficiary() == "" || pbData.GetEventDate() <= 0 {
		return nil, status.Errorf(codes.InvalidArgument,
			"missing/bad args")
	}

	listData := &database.ListData{
		Name:        pbData.GetName(),
		Beneficiary: pbData.GetBeneficiary(),
		EventDate:   time.Unix(pbData.GetEventDate(), 0),
		Active:      true,
	}

	list, err := s.db.CreateList(ctx, session.User.ID, listData,
		s.clock.Now())
	if err != nil {
		return nil, err
	}

	return &lspb.CreateListResponse{
		List: listFromDatabaseList(list),
	}, nil
}

func (s *listServer) DeactivateList(ctx context.Context, req *lspb.DeactivateListRequest) (*lspb.DeactivateListResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil || req.GetListVersion() <= 0 {
		return nil, status.Errorf(codes.InvalidArgument,
			"missing/bad args")
	}

	_, err = s.db.UpdateList(ctx, listID, int(req.GetListVersion()),
		session.User.ID, s.clock.Now(),
		func(listData *database.ListData) error {
			listData.Active = false
			return nil
		})
	if err != nil {
		return nil, err
	}

	return &lspb.DeactivateListResponse{}, nil
}

func (s *listServer) UpdateList(ctx context.Context, req *lspb.UpdateListRequest) (*lspb.UpdateListResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil || req.GetListVersion() <= 0 {
		return nil, status.Errorf(codes.InvalidArgument,
			"missing/bad args")
	}

	pbData := req.GetData()
	list, err := s.db.UpdateList(ctx, listID, int(req.GetListVersion()),
		session.User.ID, s.clock.Now(),
		func(listData *database.ListData) error {
			num := 0

			if pbData.GetName() != "" {
				listData.Name = pbData.GetName()
				num++
			}
			if pbData.GetBeneficiary() != "" {
				listData.Beneficiary = pbData.GetBeneficiary()
				num++
			}
			if pbData.GetEventDate() > 0 {
				listData.EventDate =
					time.Unix(pbData.GetEventDate(), 0)
				num++
			}

			if num == 0 {
				return status.Errorf(codes.InvalidArgument,
					"no values to set")
			}
			return nil
		})
	if err != nil {
		return nil, err
	}

	return &lspb.UpdateListResponse{
		List: listFromDatabaseList(list),
	}, nil
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
