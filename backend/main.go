package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	uspb "github.com/simmonmt/xmaslist/proto/user_service"
)

var (
	port              = flag.Int("port", -1, "port to use")
	dbPath            = flag.String("db", "", "path to database")
	userSessionLength = flag.Duration(
		"user_session_length", 24*time.Hour, "length of user sessions")
	sessionSecretPath = flag.String(
		"session_secret", "", "path to session secret file")
)

type userServer struct {
	clock          Clock
	sessionManager *sessions.Manager
	db             *database.DB
}

func userInfoFromDatabaseUser(dbUser *database.User) *uspb.UserInfo {
	return &uspb.UserInfo{
		Username: dbUser.Username,
		Fullname: dbUser.Fullname,
		IsAdmin:  dbUser.Admin,
	}
}

func (s *userServer) Login(ctx context.Context, req *uspb.LoginRequest) (*uspb.LoginResponse, error) {
	if req.GetUsername() == "" || req.GetPassword() == "" {
		return nil, fmt.Errorf("missing username or password")
	}

	userID, err := s.db.AuthenticateUser(
		ctx, req.GetUsername(), req.GetPassword())
	if err != nil {
		return nil, err
	}

	user, err := s.db.LookupUser(ctx, userID)

	cookie, expiry, err := s.sessionManager.CreateSession(ctx, user)
	if err != nil {
		return nil, err
	}

	return &uspb.LoginResponse{
		Success:  true,
		Cookie:   cookie,
		Expiry:   expiry.Unix(),
		UserInfo: userInfoFromDatabaseUser(user),
	}, nil
}

func (s *userServer) Logout(ctx context.Context, req *uspb.LogoutRequest) (*uspb.LogoutResponse, error) {
	if req.GetCookie() == "" {
		return nil, fmt.Errorf("missing cookie in request")
	}

	if err := s.sessionManager.DeactivateSession(ctx, req.GetCookie()); err != nil {
		log.Printf("logout failure: %v", err)
	}

	return &uspb.LogoutResponse{}, nil
}

func readSessionSecret(path string) (string, error) {
	a, err := ioutil.ReadFile(path)
	if err != nil {
		return "", err
	}

	secret := strings.TrimSpace(string(a))
	if len(secret) == 0 {
		return "", fmt.Errorf("secret is empty")
	}

	return secret, nil
}

func main() {
	flag.Parse()

	if *port == -1 {
		log.Fatalf("--port is required")
	}
	if *dbPath == "" {
		log.Fatalf("--db is required")
	}
	if *sessionSecretPath == "" {
		log.Fatalf("--session_secret is required")
	}

	sessionSecret, err := readSessionSecret(*sessionSecretPath)
	if err != nil {
		log.Fatalf("failed to read session secret: %v", err)
	}

	clock := &util.RealClock{}

	dbArgs := url.Values{}
	dbArgs.Set("_mutex", "full")

	dbURL := url.URL{
		Scheme:   "file",
		Path:     *dbPath,
		RawQuery: dbArgs.Encode(),
	}
	log.Printf("DSN = %s\n", dbURL.String())

	db, err := database.Open(dbURL.String())
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	sessionManager := sessions.NewManager(
		db, clock, *userSessionLength, sessionSecret)

	sock, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	handlers := &userServer{
		clock:          clock,
		sessionManager: sessionManager,
		db:             db,
	}

	opts := []grpc.ServerOption{}
	server := grpc.NewServer(opts...)
	uspb.RegisterUserServiceServer(server, handlers)
	reflection.Register(server)

	log.Printf("serving on port %v...\n", *port)
	if err := server.Serve(sock); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
