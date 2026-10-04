package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/simmonmt/xmaslist/backend/request"
	"github.com/simmonmt/xmaslist/backend/sessions"
)

// AuthInterceptor requires a valid session cookie (in the Authorization
// header) for every procedure outside of AuthService, and stores the session
// in the request context.
type AuthInterceptor struct {
	sessionManager *sessions.Manager
}

var _ connect.Interceptor = &AuthInterceptor{}

func (ai *AuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		ctx, err := ai.intercept(ctx, req.Spec(), req.Header())
		if err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

func (ai *AuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (ai *AuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		ctx, err := ai.intercept(ctx, conn.Spec(), conn.RequestHeader())
		if err != nil {
			return err
		}
		return next(ctx, conn)
	}
}

func (ai *AuthInterceptor) intercept(ctx context.Context, spec connect.Spec, header http.Header) (context.Context, error) {
	// Skip auth for AuthService because AuthService does its own auth.
	if strings.HasPrefix(spec.Procedure, "/xmaslist.AuthService/") {
		return ctx, nil
	}

	session, err := ai.authorize(ctx, header)
	if err != nil {
		return ctx, err
	}

	return context.WithValue(ctx, request.SessionKey, session), nil
}

func (ai *AuthInterceptor) authorize(ctx context.Context, header http.Header) (*sessions.Session, error) {
	authHeader := header.Values("Authorization")
	if len(authHeader) == 0 {
		return nil, connect.NewError(connect.CodeUnauthenticated,
			errors.New("no cookie found"))
	}

	cookie := authHeader[0]
	valid, sessionID := ai.sessionManager.SessionIDFromCookie(cookie)
	if !valid {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("invalid cookie"))
	}

	session, err := ai.sessionManager.LookupActiveSession(ctx, sessionID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if session == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated,
			fmt.Errorf("no active session for cookie %v", cookie))
	}

	return session, nil
}
