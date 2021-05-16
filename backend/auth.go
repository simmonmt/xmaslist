package main

import (
	"context"
	"fmt"
	"strings"

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
		if err := ai.isAuthorized(ctx); err != nil {
			return nil, err
		}
	}

	return handler(ctx, req)
}

func (ai *AuthInterceptor) isAuthorized(ctx context.Context) error {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Errorf(codes.InvalidArgument, "no metadata found")
	}

	authHeader, ok := md["authorization"]
	if !ok || len(authHeader) == 0 {
		return status.Errorf(codes.Unauthenticated, "no auth token found")
	}

	token := authHeader[0]
	fmt.Printf("got token %v\n", token)
	authorized, err := ai.sessionManager.SessionIsActive(ctx, token)
	if err != nil {
		return status.Errorf(codes.Internal, "%v", err)
	}

	if !authorized {
		return status.Errorf(codes.Unauthenticated, "no active session")
	}

	return nil
}
