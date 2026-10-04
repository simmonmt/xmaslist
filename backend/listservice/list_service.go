package listservice

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"connectrpc.com/connect"
	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/database/dbutil"
	"github.com/simmonmt/xmaslist/backend/request"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"

	lspb "github.com/simmonmt/xmaslist/proto/list_service"
	"github.com/simmonmt/xmaslist/proto/list_service/list_serviceconnect"
)

type listServer struct {
	list_serviceconnect.UnimplementedListServiceHandler

	clock          util.Clock
	sessionManager *sessions.Manager
	db             *database.DB
}

func getSession(ctx context.Context) (*sessions.Session, error) {
	val := ctx.Value(request.SessionKey)
	if val == nil {
		return nil, connect.NewError(connect.CodeInternal,
			errors.New("missing session"))
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

func (s *listServer) ListLists(ctx context.Context, connectReq *connect.Request[lspb.ListListsRequest]) (*connect.Response[lspb.ListListsResponse], error) {
	req := connectReq.Msg
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

	return connect.NewResponse(resp), nil
}

func (s *listServer) GetList(ctx context.Context, connectReq *connect.Request[lspb.GetListRequest]) (*connect.Response[lspb.GetListResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid list id"))
	}

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&lspb.GetListResponse{
		List: listFromDatabaseList(list),
	}), nil
}

func (s *listServer) CreateList(ctx context.Context, connectReq *connect.Request[lspb.CreateListRequest]) (*connect.Response[lspb.CreateListResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	pbData := req.GetData()
	if pbData.GetName() == "" || pbData.GetBeneficiary() == "" || pbData.GetEventDate() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("missing/bad args"))
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

	return connect.NewResponse(&lspb.CreateListResponse{
		List: listFromDatabaseList(list),
	}), nil
}

func (s *listServer) ChangeActiveState(ctx context.Context, connectReq *connect.Request[lspb.ChangeActiveStateRequest]) (*connect.Response[lspb.ChangeActiveStateResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil || req.GetListVersion() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("missing/bad args"))
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

	return connect.NewResponse(&lspb.ChangeActiveStateResponse{}), nil
}

func (s *listServer) UpdateList(ctx context.Context, connectReq *connect.Request[lspb.UpdateListRequest]) (*connect.Response[lspb.UpdateListResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil || req.GetListVersion() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("missing/bad args"))
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
				return connect.NewError(connect.CodeInvalidArgument,
					errors.New("no values to set"))
			}
			return nil
		})
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&lspb.UpdateListResponse{
		List: listFromDatabaseList(list),
	}), nil
}

func (s *listServer) ListListItems(ctx context.Context, connectReq *connect.Request[lspb.ListListItemsRequest]) (*connect.Response[lspb.ListListItemsResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid list id"))
	}

	items, err := s.db.ListListItems(ctx, listID, database.AllItems())
	if err != nil {
		return nil, err
	}

	resp := &lspb.ListListItemsResponse{}
	for _, item := range items {
		resp.Items = append(resp.Items, itemFromDatabaseItem(item))
	}

	return connect.NewResponse(resp), nil
}

func (s *listServer) CreateListItem(ctx context.Context, connectReq *connect.Request[lspb.CreateListItemRequest]) (*connect.Response[lspb.CreateListItemResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid list id"))
	}

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	if list.OwnerID != session.User.ID {
		return nil, connect.NewError(connect.CodePermissionDenied,
			errors.New("user does not own list"))
	}

	pbData := req.GetData()
	if pbData.GetName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("missing/bad args"))
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

	return connect.NewResponse(&lspb.CreateListItemResponse{
		Item: itemFromDatabaseItem(listItem),
	}), nil
}

func (s *listServer) DeleteListItem(ctx context.Context, connectReq *connect.Request[lspb.DeleteListItemRequest]) (*connect.Response[lspb.DeleteListItemResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid list id"))
	}

	itemID, err := strconv.Atoi(req.GetItemId())
	if req.GetItemId() == "" || err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid item id"))
	}

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	if list.OwnerID != session.User.ID {
		return nil, connect.NewError(connect.CodePermissionDenied,
			errors.New("user does not own list"))
	}

	if err := s.db.DeleteListItem(ctx, listID, itemID); err != nil {
		return nil, err
	}

	return connect.NewResponse(&lspb.DeleteListItemResponse{}), nil
}

func (s *listServer) UpdateListItem(ctx context.Context, connectReq *connect.Request[lspb.UpdateListItemRequest]) (*connect.Response[lspb.UpdateListItemResponse], error) {
	req := connectReq.Msg
	session, err := getSession(ctx)
	if session == nil {
		return nil, err
	}

	listID, err := strconv.Atoi(req.GetListId())
	if req.GetListId() == "" || err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid list id"))
	}

	list, err := dbutil.GetList(ctx, s.db, listID)
	if err != nil {
		return nil, err
	}

	if !list.Active {
		return nil, connect.NewError(connect.CodeFailedPrecondition,
			errors.New("list is not active"))
	}

	itemID, err := strconv.Atoi(req.GetItemId())
	if req.GetItemId() == "" || err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid item id"))
	}

	if req.GetItemVersion() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("missing item version"))
	}

	if req.Data != nil {
		if list.OwnerID != session.User.ID {
			return nil, connect.NewError(connect.CodePermissionDenied,
				errors.New("only owner can update list data"))
		}

		if req.Data.GetName() == "" {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				errors.New("invalid item name"))
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
						return connect.NewError(connect.CodeFailedPrecondition,
							errors.New("item is already claimed"))
					}
					if session.User.ID != list.OwnerID && session.User.ID != state.ClaimedBy {
						return connect.NewError(connect.CodePermissionDenied,
							errors.New("can't unclaim item already "+
								"claimed by another user"))
					}
				} else {
					if !req.State.GetClaimed() {
						return connect.NewError(connect.CodeFailedPrecondition,
							errors.New("item isn't claimed"))
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

	return connect.NewResponse(&lspb.UpdateListItemResponse{
		Item: itemFromDatabaseItem(item),
	}), nil
}

func RegisterHandlers(mux *http.ServeMux, clock util.Clock, sessionManager *sessions.Manager, db *database.DB, opts ...connect.HandlerOption) {
	handlers := &listServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}

	mux.Handle(list_serviceconnect.NewListServiceHandler(handlers, opts...))
}
