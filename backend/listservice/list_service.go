package listservice

import (
	"context"
	"strconv"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/dbutil"
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

func itemFromDatabaseItem(item *database.ListItem) *lspb.ListItem {
	claimedWhen := item.ClaimedWhen.Unix()
	if item.ClaimedWhen.IsZero() {
		claimedWhen = 0
	}

	return &lspb.ListItem{
		Id:      strconv.Itoa(item.ID),
		Version: int32(item.Version),
		ListId:  strconv.Itoa(item.ListID),

		Data: &lspb.ListItemData{
			Name: item.Name,
			Desc: item.Desc,
			Url:  item.URL,
		},

		Metadata: &lspb.ListItemMetadata{
			Created:     item.Created.Unix(),
			Updated:     item.Updated.Unix(),
			ClaimedBy:   int32(item.ClaimedBy),
			ClaimedWhen: claimedWhen,
		},

		State: &lspb.ListItemState{
			Claimed: bool(item.ClaimedBy != 0),
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

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	return &lspb.GetListResponse{
		List: listFromDatabaseList(list),
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

func (s *listServer) ChangeActiveState(ctx context.Context, req *lspb.ChangeActiveStateRequest) (*lspb.ChangeActiveStateResponse, error) {
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
			listData.Active = req.GetNewState()
			return nil
		})
	if err != nil {
		return nil, err
	}

	return &lspb.ChangeActiveStateResponse{}, nil
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
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" {
		return nil, status.Errorf(codes.InvalidArgument,
			"invalid list id")
	}

	items, err := s.db.ListListItems(ctx, listID, database.AllItems())
	if err != nil {
		return nil, err
	}

	resp := &lspb.ListListItemsResponse{}
	for _, item := range items {
		resp.Items = append(resp.Items, itemFromDatabaseItem(item))
	}

	return resp, nil
}

func (s *listServer) CreateListItem(ctx context.Context, req *lspb.CreateListItemRequest) (*lspb.CreateListItemResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" {
		return nil, status.Errorf(codes.InvalidArgument,
			"invalid list id")
	}

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	if list.OwnerID != session.User.ID {
		return nil, status.Errorf(codes.PermissionDenied,
			"user does not own list")
	}

	pbData := req.GetData()
	if pbData.GetName() == "" {
		return nil, status.Errorf(codes.InvalidArgument,
			"missing/bad args")
	}

	listItemData := &database.ListItemData{
		Name: pbData.GetName(),
		Desc: pbData.GetDesc(),
		URL:  pbData.GetUrl(),
	}

	listItem, err := s.db.CreateListItem(ctx, listID, listItemData,
		s.clock.Now())
	if err != nil {
		return nil, err
	}

	return &lspb.CreateListItemResponse{
		Item: itemFromDatabaseItem(listItem),
	}, nil
}

func (s *listServer) DeleteListItem(ctx context.Context, req *lspb.DeleteListItemRequest) (*lspb.DeleteListItemResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" {
		return nil, status.Errorf(codes.InvalidArgument,
			"invalid list id")
	}

	itemID, err := strconv.Atoi(req.GetItemId())
	if req.GetItemId() == "" {
		return nil, status.Errorf(codes.InvalidArgument,
			"invalid item id")
	}

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	if list.OwnerID != session.User.ID {
		return nil, status.Errorf(codes.PermissionDenied,
			"user does not own list")
	}

	if err := s.db.DeleteListItem(ctx, listID, itemID); err != nil {
		return nil, err
	}

	return &lspb.DeleteListItemResponse{}, nil
}

func (s *listServer) UpdateListItem(ctx context.Context, req *lspb.UpdateListItemRequest) (*lspb.UpdateListItemResponse, error) {
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" {
		return nil, status.Errorf(codes.InvalidArgument,
			"invalid list id")
	}

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	if !list.Active {
		return nil, status.Errorf(codes.FailedPrecondition,
			"list is not active")
	}

	itemID, err := strconv.Atoi(req.GetItemId())
	if req.GetItemId() == "" || err != nil {
		return nil, status.Errorf(codes.InvalidArgument,
			"invalid item id")
	}

	if req.GetItemVersion() == 0 {
		return nil, status.Errorf(codes.InvalidArgument,
			"missing item version")
	}

	if req.Data != nil {
		if list.OwnerID != session.User.ID {
			return nil, status.Errorf(codes.PermissionDenied,
				"only owner can update list data")
		}

		if req.Data.GetName() == "" {
			return nil, status.Errorf(codes.InvalidArgument,
				"invalid item name")
		}
	}

	now := s.clock.Now()
	item, err := s.db.UpdateListItem(ctx, list.ID, itemID,
		int(req.GetItemVersion()), now,
		func(data *database.ListItemData, state *database.ListItemState) error {
			if req.Data != nil {
				data.Name = req.Data.GetName()
				data.Desc = req.Data.GetDesc()
				data.URL = req.Data.GetUrl()
			}

			if req.State != nil {
				if state.ClaimedBy != 0 {
					if req.State.GetClaimed() {
						return status.Errorf(
							codes.FailedPrecondition,
							"item is already claimed")
					}
					if session.User.ID != state.ClaimedBy {
						return status.Errorf(
							codes.PermissionDenied,
							"can't unclaim item already "+
								"claimed by another user")
					}
				} else {
					if !req.State.GetClaimed() {
						return status.Errorf(
							codes.FailedPrecondition,
							"item isn't claimed")
					}
				}

				if req.State.GetClaimed() {
					state.ClaimedBy = session.User.ID
				} else {
					state.ClaimedBy = 0
				}
			}

			return nil
		})
	if err != nil {
		return nil, err
	}

	return &lspb.UpdateListItemResponse{
		Item: itemFromDatabaseItem(item),
	}, nil
}

func RegisterHandlers(server *grpc.Server, clock util.Clock, sessionManager *sessions.Manager, db *database.DB) {
	handlers := &listServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}

	lspb.RegisterListServiceServer(server, handlers)
}
