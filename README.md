# xmaslist

A small web app for sharing Christmas (and other gift) lists. Users create
lists of things they'd like; other users view those lists and claim items, so
two people don't buy the same gift. There is no sign-up: an admin creates
users with `db_util` (see [docs/OPERATIONS.md](docs/OPERATIONS.md)).

## Architecture

- **One Go server** (`backend/`, using [connect-go](https://connectrpc.com))
  serves the RPCs (Connect, gRPC and gRPC-Web, on one port) and, with
  `--serve_dir`, the built client.
- **Client** (`client/`): a React single-page app (MUI, react-router), built
  with Vite. It calls the server with connect-es (Connect protocol, JSON).
- **Storage**: one SQLite file (`db/schema/schema.txt`).
- **Protos** (`proto/*.proto`) define the API. `make gen` generates the Go and
  TypeScript code from them; the generated code is not checked in.

In production it all runs as a single Docker container (`simmonmt/xmaslist`).

## Repository layout

| Path           | What                                                       |
| -------------- | ---------------------------------------------------------- |
| `backend/`     | The server (`main.go` has the flags)                       |
| `client/`      | The React client                                           |
| `proto/`       | API definitions                                            |
| `cmd/db_util/` | Admin CLI: create/list users, lists and items; load a spec |
| `db/`          | Schema, sample data, scripts for the production DB volume  |
| `docker/`      | Compose files and scripts for the dev and prod stacks      |
| `docs/`        | [Operations runbook](docs/OPERATIONS.md)                   |
| `Dockerfile`   | Builds the image                                           |
| `Makefile`     | Code generation, builds, tests, dev servers                |

## Prerequisites

- Go 1.26+, with a C compiler (the SQLite driver uses cgo)
- Node.js 22.22+ and npm
- GNU make and bash
- `sqlite3` (to create databases from the schema)
- Docker with Compose v2 (`docker compose`), for images and the docker stacks
- GNU getopt for `docker/docker-compose-dev` and `db/create` (on macOS:
  `brew install gnu-getopt`; the scripts use it when it's installed)

## Development quick start

```sh
git clone https://github.com/simmonmt/xmaslist.git
cd xmaslist
make gen      # also installs node_modules

# A dev database with sample data (users a/aa, an admin, and b/bb).
db/create --local dev.sqlite --load_test_data

make run-backend DB=dev.sqlite   # backend on port 8082; leave it running
make dev                         # in another terminal: Vite on port 8083
```

Open http://localhost:8083 and log in as `a` (password `aa`) or `b` (`bb`).
Vite serves the client with hot reloading and proxies RPCs (`/xmaslist.*`) to
the backend; set `XMASLIST_BACKEND` to proxy to a backend elsewhere (default
`http://localhost:8082`). Pass backend flags with `ARGS`, e.g.
`make run-backend DB=dev.sqlite ARGS=--slow_responses=2s` (see the flags
reference in [docs/OPERATIONS.md](docs/OPERATIONS.md#backend-flags)). Restart
`make run-backend` after changing Go code.

To use your own data instead, write a spec like `db/test_data.yaml` (see
`go run ./cmd/db_util help load`), or add users one at a time with
`go run ./cmd/db_util user create ...`.

## Tests and checks

```sh
make test     # Go tests, go vet, TypeScript typecheck, prettier --check
make build    # everything, including the client bundle
```

Optionally, `go run honnef.co/go/tools/cmd/staticcheck@latest ./...`.

## Changing the protos

Edit `proto/*.proto`, then run `make gen` (or `make gen-go` / `make gen-js`).
If `make dev` is running, restart it after regenerating the TypeScript code;
restart `make run-backend` too. `make clean` removes all generated code and
build output.

## Building the image

```sh
make images            # simmonmt/xmaslist:latest
make images TAG=v42    # simmonmt/xmaslist:v42
```

The image contains only the server and the built client. To try it locally
with a dev database on http://localhost:8080:

```sh
docker/docker-compose-dev --db=dev.sqlite up -d
docker/docker-compose-dev --db=dev.sqlite down
```

Deployment, backups and the rest are in
[docs/OPERATIONS.md](docs/OPERATIONS.md).
