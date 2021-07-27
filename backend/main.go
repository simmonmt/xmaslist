package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"github.com/simmonmt/xmaslist/backend/authservice"
	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/listservice"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/userservice"
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
	slowResponses = flag.String("slow_responses", "",
		"if a duration, sleep before each response. if a comma-separated "+
			"list of k=v pairs (method=duration), sleep the specific "+
			"methods by the specified amounts")
	errorResponses = flag.String("error_responses", "",
		"if a code, return for all requests. if a comma-separated "+
			"list of k=v pairs (method=code), fail the specified "+
			"methods with the given codes")

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

type SlowResponseInterceptor struct {
	allDelay time.Duration
	delays   map[string]time.Duration
}

func (i *SlowResponseInterceptor) Intercept(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	res, err := handler(ctx, req)

	if i.allDelay != 0 {
		time.Sleep(i.allDelay)
	} else if delay, found := i.delays[info.FullMethod]; found {
		log.Printf("delaying %v by %v\n", info.FullMethod, delay)
		time.Sleep(delay)
	}

	return res, err
}

func makeSlowResponseInterceptor(specStr string) (*SlowResponseInterceptor, error) {
	d, err := time.ParseDuration(specStr)
	if err == nil {
		return &SlowResponseInterceptor{allDelay: d}, nil
	}

	delays := map[string]time.Duration{}
	parts := strings.Split(specStr, ",")
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			return nil, fmt.Errorf("failed to parse %v", part)
		}

		method := kv[0]
		d, err := time.ParseDuration(kv[1])
		if err != nil {
			return nil, fmt.Errorf(
				"failed to parse duration in %v: %v",
				part, err)
		}

		delays[method] = d
	}

	if len(delays) == 0 {
		return nil, fmt.Errorf("no delays found in spec")
	}

	return &SlowResponseInterceptor{delays: delays}, nil
}

func parseCode(str string) (codes.Code, error) {
	str = `"` + str + `"`

	var c codes.Code
	if err := c.UnmarshalJSON([]byte(str)); err != nil {
		return codes.OK, err
	}
	return c, nil
}

type ErrorResponseInterceptor struct {
	allError codes.Code
	errors   map[string]codes.Code
}

func (i *ErrorResponseInterceptor) Intercept(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	if i.allError != codes.OK {
		return nil, status.Errorf(i.allError, "injected error")
	} else if c, found := i.errors[info.FullMethod]; found {
		log.Printf("failing %v: %v\n", info.FullMethod, c)
		return nil, status.Errorf(c, "injected error")
	}

	return handler(ctx, req)
}

func makeErrorResponseInterceptor(specStr string) (*ErrorResponseInterceptor, error) {
	c, err := parseCode(specStr)
	if err == nil {
		return &ErrorResponseInterceptor{allError: c}, nil
	}

	errors := map[string]codes.Code{}
	parts := strings.Split(specStr, ",")
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			return nil, fmt.Errorf("failed to parse %v", part)
		}

		method := kv[0]
		c, err := parseCode(kv[1])
		if err != nil {
			return nil, fmt.Errorf(
				"failed to parse code in %v: %v",
				part, err)
		}

		errors[method] = c
	}

	if len(errors) == 0 {
		return nil, fmt.Errorf("no codes found in spec")
	}

	return &ErrorResponseInterceptor{errors: errors}, nil
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

	db, err := database.Open(*dbPath)
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

	interceptors := []grpc.UnaryServerInterceptor{
		loggingInterceptor,
		errorRewriteInterceptor,
		authInterceptor.intercept,
	}

	if *slowResponses != "" {
		interceptor, err := makeSlowResponseInterceptor(*slowResponses)
		if err != nil {
			log.Fatalf("failed to build slow response interceptor: %v", err)
		}

		interceptors = append(interceptors, interceptor.Intercept)
	}

	if *errorResponses != "" {
		interceptor, err := makeErrorResponseInterceptor(*errorResponses)
		if err != nil {
			log.Fatalf("failed to build error response interceptor: %v", err)
		}

		interceptors = append(interceptors, interceptor.Intercept)
	}

	opts := []grpc.ServerOption{
		grpc.ChainUnaryInterceptor(interceptors...),
	}

	server := grpc.NewServer(opts...)
	authservice.RegisterHandlers(server, clock, sessionManager, db)
	listservice.RegisterHandlers(server, clock, sessionManager, db)
	userservice.RegisterHandlers(server, clock, db)
	reflection.Register(server)

	log.Printf("serving on port %v...\n", *port)
	if err := server.Serve(sock); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
