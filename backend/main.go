package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"connectrpc.com/connect"
	"connectrpc.com/grpcreflect"
	"github.com/simmonmt/xmaslist/backend/authservice"
	"github.com/simmonmt/xmaslist/backend/database"
	"github.com/simmonmt/xmaslist/backend/listservice"
	"github.com/simmonmt/xmaslist/backend/sessions"
	"github.com/simmonmt/xmaslist/backend/userservice"
	"github.com/simmonmt/xmaslist/backend/util"
	"github.com/simmonmt/xmaslist/proto/auth_service/auth_serviceconnect"
	"github.com/simmonmt/xmaslist/proto/list_service/list_serviceconnect"
	"github.com/simmonmt/xmaslist/proto/user_service/user_serviceconnect"
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
)

func readSessionSecret(path string) (string, error) {
	a, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	secret := strings.TrimSpace(string(a))
	if len(secret) == 0 {
		return "", fmt.Errorf("secret is empty")
	}

	return secret, nil
}

func loggingInterceptor(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (res connect.AnyResponse, err error) {
		start := time.Now()
		res, err = next(ctx, req)
		log.Printf("Request - Method:%s Protocol:%s Duration:%s Error:%v\n",
			req.Spec().Procedure, req.Peer().Protocol,
			time.Since(start), err)
		return
	}
}

// errorRewriteInterceptor turns errors that aren't *connect.Error into
// CodeInternal errors (connect would otherwise report them as CodeUnknown).
func errorRewriteInterceptor(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		res, err := next(ctx, req)
		if err != nil {
			var connectErr *connect.Error
			if errors.As(err, &connectErr) {
				return nil, err
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}

		return res, err
	}
}

type SlowResponseInterceptor struct {
	allDelay time.Duration
	delays   map[string]time.Duration
}

func (i *SlowResponseInterceptor) Intercept(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		res, err := next(ctx, req)

		method := req.Spec().Procedure
		if i.allDelay != 0 {
			time.Sleep(i.allDelay)
		} else if delay, found := i.delays[method]; found {
			log.Printf("delaying %v by %v\n", method, delay)
			time.Sleep(delay)
		}

		return res, err
	}
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

// codeOK stands in for gRPC's OK code, which connect doesn't define. It means
// "don't inject an error".
const codeOK connect.Code = 0

// codesByName maps gRPC code names (e.g. PERMISSION_DENIED), as accepted by
// --error_responses, to connect codes.
var codesByName = map[string]connect.Code{
	"OK":        codeOK,
	"CANCELLED": connect.CodeCanceled, // connect spells it "canceled"
}

func init() {
	for c := connect.CodeUnknown; c <= connect.CodeUnauthenticated; c++ {
		codesByName[strings.ToUpper(c.String())] = c
	}
}

func parseCode(str string) (connect.Code, error) {
	c, found := codesByName[str]
	if !found {
		return codeOK, fmt.Errorf("invalid code: %q", str)
	}
	return c, nil
}

type ErrorResponseInterceptor struct {
	allError connect.Code
	errors   map[string]connect.Code
}

func (i *ErrorResponseInterceptor) Intercept(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		method := req.Spec().Procedure
		if i.allError != codeOK {
			return nil, connect.NewError(i.allError,
				errors.New("injected error"))
		} else if c, found := i.errors[method]; found && c != codeOK {
			log.Printf("failing %v: %v\n", method, c)
			return nil, connect.NewError(c,
				errors.New("injected error"))
		}

		return next(ctx, req)
	}
}

func makeErrorResponseInterceptor(specStr string) (*ErrorResponseInterceptor, error) {
	c, err := parseCode(specStr)
	if err == nil {
		return &ErrorResponseInterceptor{allError: c}, nil
	}

	errors := map[string]connect.Code{}
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

	interceptors := []connect.Interceptor{
		connect.UnaryInterceptorFunc(loggingInterceptor),
		connect.UnaryInterceptorFunc(errorRewriteInterceptor),
		&authInterceptor,
	}

	if *slowResponses != "" {
		interceptor, err := makeSlowResponseInterceptor(*slowResponses)
		if err != nil {
			log.Fatalf("failed to build slow response interceptor: %v", err)
		}

		interceptors = append(interceptors,
			connect.UnaryInterceptorFunc(interceptor.Intercept))
	}

	if *errorResponses != "" {
		interceptor, err := makeErrorResponseInterceptor(*errorResponses)
		if err != nil {
			log.Fatalf("failed to build error response interceptor: %v", err)
		}

		interceptors = append(interceptors,
			connect.UnaryInterceptorFunc(interceptor.Intercept))
	}

	// Match grpc-go's default 4 MiB cap on incoming messages.
	readMaxBytes := connect.WithReadMaxBytes(4 << 20)

	opts := []connect.HandlerOption{
		connect.WithInterceptors(interceptors...),
		readMaxBytes,
	}

	mux := http.NewServeMux()
	authservice.RegisterHandlers(mux, clock, sessionManager, db, opts...)
	listservice.RegisterHandlers(mux, clock, sessionManager, db, opts...)
	userservice.RegisterHandlers(mux, clock, db, opts...)

	reflector := grpcreflect.NewStaticReflector(
		auth_serviceconnect.AuthServiceName,
		list_serviceconnect.ListServiceName,
		user_serviceconnect.UserServiceName,
	)
	mux.Handle(grpcreflect.NewHandlerV1(reflector, readMaxBytes))
	mux.Handle(grpcreflect.NewHandlerV1Alpha(reflector, readMaxBytes))

	// Serve HTTP/1.1 (Connect, gRPC-Web) as well as unencrypted HTTP/2
	// (h2c), which gRPC clients (Envoy, grpcurl) require.
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)

	server := &http.Server{
		Handler:   mux,
		Protocols: protocols,
	}

	log.Printf("serving on port %v...\n", *port)
	if err := server.Serve(sock); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
