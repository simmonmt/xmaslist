package main

import (
	"context"
	"strings"

	"github.com/simmonmt/xmaslist/backend/request"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type AuthInterceptor struct {
	sessionManager *sessions.Manager
}

func (ai *AuthInterceptor) intercept(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	// Skip auth for LoginService because LoginService does its own auth.
	if !strings.HasPrefix(info.FullMethod, "/xmaslist.LoginService/") {
		session, err := ai.authorize(ctx)
		if err != nil {
			return nil, err
		}

		ctx = context.WithValue(ctx, request.SessionKey, session)
	}

	return handler(ctx, req)
}

func (ai *AuthInterceptor) authorize(ctx context.Context) (*sessions.Session, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.InvalidArgument, "no metadata found")
	}

	authHeader, ok := md["authorization"]
	if !ok || len(authHeader) == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "no cookie found")
	}

	cookie := authHeader[0]
	valid, sessionID := ai.sessionManager.SessionIDFromCookie(cookie)
	if !valid {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cookie")
	}

	session, err := ai.sessionManager.LookupActiveSession(ctx, sessionID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "%v", err)
	}
	if session == nil {
		return nil, status.Errorf(codes.Unauthenticated,
			"no active session")
	}

	return session, nil
}
