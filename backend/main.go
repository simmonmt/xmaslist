package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/simmonmt/xmaslist/backend/authservice"
	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/listservice"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/util"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
)

var (
	port              = flag.Int("port", -1, "port to use")
	dbPath            = flag.String("db", "", "path to database")
	userSessionLength = flag.Duration(
		"user_session_length", 24*time.Hour, "length of user sessions")
	sessionSecretPath = flag.String(
		"session_secret", "", "path to session secret file")

	grpcLog grpclog.LoggerV2
)

func init() {
	grpcLog = grpclog.NewLoggerV2(os.Stdout, os.Stderr, os.Stderr)
	grpclog.SetLoggerV2(grpcLog)
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

func loggingInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (res interface{}, err error) {
	start := time.Now()
	res, err = handler(ctx, req)
	grpcLog.Infof("Request - Method:%s Duration:%s Error:%v\n",
		info.FullMethod, time.Since(start), err)
	return
}

func errorRewriteInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	res, err := handler(ctx, req)
	if err != nil {
		if _, ok := status.FromError(err); ok {
			return nil, err
		}
		return nil, status.Errorf(codes.Internal, "%v", err)
	}

	return res, err
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

	authInterceptor := AuthInterceptor{
		sessionManager: sessionManager,
	}

	opts := []grpc.ServerOption{
		grpc.ChainUnaryInterceptor(
			loggingInterceptor,
			errorRewriteInterceptor,
			authInterceptor.intercept),
	}
	server := grpc.NewServer(opts...)
	authservice.RegisterHandlers(server, clock, sessionManager, db)
	listservice.RegisterHandlers(server, clock, sessionManager, db)
	reflection.Register(server)

	log.Printf("serving on port %v...\n", *port)
	if err := server.Serve(sock); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
