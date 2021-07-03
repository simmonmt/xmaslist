load("@bazel_gazelle//:deps.bzl", "go_repository")

def go_repositories():
    go_repository(
        name = "com_github_google_go_cmp",
        importpath = "github.com/google/go-cmp",
        sum = "h1:BKbKCqvP6I+rmFHt06ZmyQtvB8xAkWdhFyr0ZUNZcxQ=",
        version = "v0.5.6",
    )

    go_repository(
        name = "com_github_google_subcommands",
        importpath = "github.com/google/subcommands",
        sum = "h1:vWQspBTo2nEqTUFita5/KeEWlUL8kQObDFbub/EN9oE=",
        version = "v1.2.0",
    )

    go_repository(
        name = "com_github_mattn_go_sqlite3",
        importpath = "github.com/mattn/go-sqlite3",
        sum = "h1:fxWBnXkxfM6sRiuH3bqJ4CfzZojMOLVc0UTsTglEghA=",
        version = "v1.14.7",
    )
    go_repository(
        name = "com_github_protocolbuffers_protobuf_go",
        importpath = "github.com/protocolbuffers/protobuf-go",
        sum = "h1:87FpR4+tNpkRgqyCUcaRv9Jj+Lc+uWj1jHXRnn6l4ow=",
        version = "v1.27.1",
    )

    go_repository(
        name = "com_github_roberthodgen_spa_server",
        importpath = "github.com/roberthodgen/spa-server",
        sum = "h1:GDTuxylfsSbc8CHl6kNC9an/tUoe1EklYP5Uc6qoxCA=",
        version = "v0.0.0-20171007154335-bb87b4ff3253",
    )
    go_repository(
        name = "in_gopkg_yaml_v2",
        importpath = "gopkg.in/yaml.v2",
        sum = "h1:D8xgwECY7CYvx+Y2n4sBz93Jn9JRvxdiyyo8CTfuKaY=",
        version = "v2.4.0",
    )

    go_repository(
        name = "org_golang_google_grpc",
        build_file_proto_mode = "disable",
        importpath = "google.golang.org/grpc",
        sum = "h1:uSZWeQJX5j11bIQ4AJoj+McDBo29cY1MCoC1wO3ts+c=",
        version = "v1.37.0",
    )
    go_repository(
        name = "org_golang_x_net",
        importpath = "golang.org/x/net",
        sum = "h1:0PC75Fz/kyMGhL0e1QnypqK2kQMqKt9csD1GnMJR+Zk=",
        version = "v0.0.0-20210423184538-5f58ad60dda6",
    )
    go_repository(
        name = "org_golang_x_text",
        importpath = "golang.org/x/text",
        sum = "h1:aRYxNxv6iGQlyVaZmk6ZgYEDa+Jg18DxebPSrd6bg1M=",
        version = "v0.3.6",
    )
