module github.com/simmonmt/xmaslist

go 1.26.0

require (
	connectrpc.com/connect v1.21.0
	connectrpc.com/grpcreflect v1.3.1
	github.com/google/go-cmp v0.7.0
	github.com/google/subcommands v1.2.0
	github.com/mattn/go-sqlite3 v1.14.52
	google.golang.org/protobuf v1.36.12
	gopkg.in/yaml.v2 v2.4.0
)

tool (
	connectrpc.com/connect/cmd/protoc-gen-connect-go
	google.golang.org/protobuf/cmd/protoc-gen-go
)

ignore ./node_modules
