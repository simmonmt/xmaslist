package main

import (
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
	"github.com/simmonmt/xmaslist/backend/userservice"
	"github.com/simmonmt/xmaslist/backend/util"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

var (
	port              = flag.Int("port", -1, "port to use")
	dbPath            = flag.String("db", "", "path to database")
	userSessionLength = flag.Duration(
		"user_session_length", 24*time.Hour, "length of user sessions")
	sessionSecretPath = flag.String(
		"session_secret", "", "path to session secret file")
)

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

	opts := []grpc.ServerOption{}
	server := grpc.NewServer(opts...)
	userservice.RegisterHandlers(server, clock, sessionManager, db)
	reflection.Register(server)

	log.Printf("serving on port %v...\n", *port)
	if err := server.Serve(sock); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
