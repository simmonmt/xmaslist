module github.com/simmonmt/xmaslist

go 1.25.0

require (
	github.com/google/go-cmp v0.7.0
	github.com/google/subcommands v1.2.0
	github.com/mattn/go-sqlite3 v1.14.52
	github.com/roberthodgen/spa-server v0.0.0-20171007154335-bb87b4ff3253
	google.golang.org/grpc v1.84.0
	google.golang.org/protobuf v1.36.12
	gopkg.in/yaml.v2 v2.4.0
)

require (
	golang.org/x/net v0.57.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	golang.org/x/text v0.40.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800 // indirect
	google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.6.2 // indirect
)

tool (
	google.golang.org/grpc/cmd/protoc-gen-go-grpc
	google.golang.org/protobuf/cmd/protoc-gen-go
)

ignore ./node_modules
