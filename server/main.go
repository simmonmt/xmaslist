package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	uspb "github.com/simmonmt/xmaslist/proto/user_service"
)

var (
	port = flag.Int("port", -1, "port to use")
)

type userServer struct{}

func (s *userServer) Login(ctx context.Context, req *uspb.LoginRequest) (*uspb.LoginResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *userServer) Logout(ctx context.Context, req *uspb.LogoutRequest) (*uspb.LogoutResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func newServer() *userServer {
	s := &userServer{}
	return s
}

func main() {
	flag.Parse()

	if *port == -1 {
		log.Fatalf("--port is required")
	}

	sock, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", *port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	opts := []grpc.ServerOption{}
	server := grpc.NewServer(opts...)
	uspb.RegisterUserServiceServer(server, newServer())
	reflection.Register(server)

	log.Printf("serving on port %v...\n", *port)
	if err := server.Serve(sock); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
