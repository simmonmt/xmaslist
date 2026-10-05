# Operations

How to build, deploy, back up and troubleshoot xmaslist. For development, see
[README.md](../README.md).

## Overview

Production is one container on one Docker host:

| Thing     | Name                                                               |
| --------- | ------------------------------------------------------------------ |
| Image     | `simmonmt/xmaslist:<tag>` (`latest` unless `CONTAINER_TAG` is set) |
| Container | `xmaslist_prod_xmaslist` (compose project `xmaslist_prod`)         |
| Network   | `xmaslist_prod_net`                                                |
| Port      | host 3400 -> container 8080 (plain HTTP)                           |
| Database  | volume `xmaslist_database`, mounted at `/db` (`/db/db.sqlite`)     |
| Secret    | volume `xmaslist_session_secret`, mounted read-only at `/secret`   |

The server speaks plain HTTP; if it's reachable from the internet, put TLS in
front of port 3400.

`docker/docker-compose-prod` runs `docker compose` with `docker/base.yml` and
`docker/prod.yml`, passing its arguments through (`up -d`, `ps`, `logs`,
`stop`, `start`, `down`, ...). It works from any directory. Run the `db/`
scripts on the Docker host from the repo root; they need `sqlite3` (and Go,
for `--load_test_data` or `db_util`) there too.

The two volumes are external: compose never creates or deletes them, so
`down` and `up` leave the data alone.

## Building the image

```sh
make images TAG=20261005                     # simmonmt/xmaslist:20261005
docker tag simmonmt/xmaslist:20261005 simmonmt/xmaslist:latest
```

Use a new tag for each build (a date or commit id) and point `latest` at the
one to run; the old tags stay around for rollback (`docker image ls
simmonmt/xmaslist`). Build on the Docker host (or load the image there): if
the image is missing, `up` tries to pull it from Docker Hub.

## First-time setup

```sh
db/create                          # volume xmaslist_database with an empty DB
docker/make_session_secret_volume  # volume xmaslist_session_secret
```

`db/create` refuses to touch an existing volume; `db/create --rm` deletes it
first (and all its data). `db/create --load_test_data` loads the sample data
in `db/test_data.yaml` (users `a`/`aa` and `b`/`bb`) -- not for real use.
`db/create --local path` writes the database to a file instead, without
using Docker, overwriting any existing file (it can't be combined with `--rm`
or `--vol`).
`make_session_secret_volume` prints the new secret when it's done.

Then create users with the
[db_util recipe](#running-db_util-against-production-data), skipping its
`docker/docker-compose-prod stop` and `start` lines (there's no container
yet), and deploy.

## Deploying and upgrading

Build and tag the image (above), then:

```sh
docker/docker-compose-prod up -d
docker/docker-compose-prod ps
curl -sI http://localhost:3400/    # 200 from the client's index.html
```

`up -d` replaces the container when the image or configuration changed, so
an upgrade is a short outage. The client and server ship together, and
there's nothing to migrate unless a release says otherwise (the schema hasn't
changed so far). Back up the database before upgrading anyway.

The container has `restart: unless-stopped` (in `docker/prod.yml`): Docker
restarts it if it exits and brings it back after a host reboot or daemon
restart, unless it was stopped with `docker/docker-compose-prod stop`. To stop
the service: `docker/docker-compose-prod stop`, or `down` (removes the
container and network; the volumes stay).

## Migrating from the old three-container setup

This is a one-time flag-day change. The old setup ran three containers --
`xmaslist_prod_envoy` (which publishes port 3400), `xmaslist_prod_backend`
and `xmaslist_prod_frontend` -- under compose project `xmaslist`, on network
`xmaslist_prod_net`. The new container uses the same two volumes, unchanged.
The new scripts can't take the old containers down, so remove them by name.

Build the new image first (see above) to keep the outage short, and check
that everything is in place while the old stack is still running:

```sh
docker compose version                         # Compose v2 or later
docker/docker-compose-prod config >/dev/null   # compose files are valid
docker image inspect simmonmt/xmaslist:latest >/dev/null   # image is there
```

Then switch:

```sh
docker stop xmaslist_prod_envoy xmaslist_prod_backend xmaslist_prod_frontend
db/copy xmaslist-pre-migration.sqlite     # backup

docker rm xmaslist_prod_envoy xmaslist_prod_backend xmaslist_prod_frontend
docker network rm xmaslist_prod_net
docker/docker-compose-prod up -d
```

Removing the old network is optional but tidy: compose would reuse it, with a
warning that it belongs to another project; removed, it's recreated under the
new project name. If `docker network rm` says the network is in use,
something else is attached: `docker network inspect xmaslist_prod_net`.

To find any other leftovers from the old project (e.g. an old dev stack,
`xmaslist_dev_*`, network `xmaslist_dev_net`):

```sh
docker ps -a --filter label=com.docker.compose.project=xmaslist
docker network ls --filter label=com.docker.compose.project=xmaslist
```

Once you're happy with the new setup, the old images
(`simmonmt/xmaslist/backend`, `simmonmt/xmaslist/frontend`,
`envoyproxy/envoy:v1.18.2`) can be deleted with `docker image rm`.

### If the new container doesn't work

Keep the old images until you're happy with the new setup; going back needs
them. The database schema is unchanged, so the volumes work with either
stack. Take the new stack down (this removes the new network too) and start
the old one from a checkout of the pre-modernization commit, 3896562. Its
script calls the old `docker-compose` v1, so run the equivalent Compose v2
command instead:

```sh
docker/docker-compose-prod down

git clone https://github.com/simmonmt/xmaslist.git xmaslist-old
cd xmaslist-old
git checkout --detach 3896562
CONTAINER_TAG=latest CONTAINER_PREFIX=xmaslist_prod docker compose \
    --project-directory docker --project-name xmaslist \
    -f docker/base.yml -f docker/prod.yml up -d
```

Compose warns that the old files' `version` attribute is obsolete; that's
harmless. To try the new setup again, repeat the migration.

## Rolling back

Point `latest` at the previous image and recreate the container:

```sh
docker image ls simmonmt/xmaslist
docker tag simmonmt/xmaslist:20260901 simmonmt/xmaslist:latest
docker/docker-compose-prod up -d
```

`CONTAINER_TAG=20260901 docker/docker-compose-prod up -d` runs a tag without
moving `latest`, but the next `up` without `CONTAINER_TAG` switches back to
`latest`. If the release being rolled back changed the database, restore the
backup taken before the upgrade too.

## Backups and restore

`db/copy` copies `/db/db.sqlite` out of the volume (using a temporary
`alpine` container). Stop the service for a consistent copy -- a copy taken
during a write can be inconsistent:

```sh
docker/docker-compose-prod stop
db/copy xmaslist-$(date +%F).sqlite
docker/docker-compose-prod start
sqlite3 xmaslist-$(date +%F).sqlite 'PRAGMA integrity_check'   # ok
```

To restore a backup into the volume:

```sh
docker/docker-compose-prod stop
docker run --rm -v xmaslist_database:/db alpine ls -l /db
docker container create --name xmaslist_database_restore \
    -v xmaslist_database:/db alpine
docker cp xmaslist-2026-10-05.sqlite xmaslist_database_restore:/db/db.sqlite
docker container rm xmaslist_database_restore
docker/docker-compose-prod start
```

If the `ls` shows a `db.sqlite-journal`, the server died mid-write. Delete it
before copying the backup in, or SQLite will apply it to the restored file:

```sh
docker run --rm -v xmaslist_database:/db alpine rm /db/db.sqlite-journal
```

## Running db_util against production data

`db_util` (users, lists, items, spec loading) isn't in the image, and
there's no admin UI or sign-up, so adding a user means editing the database
file. Copy it out, change it, and copy it back with the service stopped, so
nothing the server writes in between gets lost:

```sh
go install ./cmd/db_util             # into $(go env GOPATH)/bin; put it on PATH
docker/docker-compose-prod stop
db/copy work.sqlite
cp work.sqlite work-before.sqlite    # in case
db_util user create --username carol --fullname "Carol Smith" \
    --password 'secret' work.sqlite
db_util user list work.sqlite
# Copy work.sqlite back as in "Backups and restore" (create/cp/rm), then:
docker/docker-compose-prod start
```

Add `--admin` for an admin user. To keep the password out of your shell
history, use `db_util user create --spec user.yaml ...` (format in
`db_util user help create`). Read-only commands (`user list`, `user lookup`,
`list list`) can use a copy taken without stopping the service. `db_util help`
lists the commands.

## Session secret

The server reads the secret (`/secret/session_secret.txt`, surrounding
whitespace ignored, must not be empty) at startup. Logging in creates a row in
the `sessions` table and returns a cookie of the form
`<session id>:<sha256(session id, secret)>`; every other RPC checks that the
cookie matches the secret and that the session exists and hasn't expired
(`--user_session_length`, default 24h). Logging out deletes the session. Each
user has at most one session, so logging in on one browser logs that user out
everywhere else.

Rotating the secret invalidates every cookie: users who were logged in are
sent to the login page on their next request. No data is lost. To rotate:

```sh
docker/make_session_secret_volume    # overwrites the secret in the volume
docker/docker-compose-prod restart
```

`docker/dev_session_secret.txt` is public; it's only for development.

## Logs

```sh
docker/docker-compose-prod logs -f     # or: docker logs -f xmaslist_prod_xmaslist
```

The server logs one line per RPC (method, protocol, duration, error), session
creation (session ID, the user's ID, username, full name and admin flag, and
the expiry), and startup/fatal errors. No passwords, cookies or secrets are
logged. There's no HTTP access log: requests for the client's files aren't
logged. Docker's default `json-file` log driver doesn't rotate logs; configure
rotation in the Docker daemon if needed.

## Ports

| Port | What                                                          |
| ---- | ------------------------------------------------------------- |
| 3400 | Production (host) -> 8080 in the container                    |
| 8080 | Dev stack (`docker/docker-compose-dev`; change with `--port`) |
| 8082 | `make run-backend`                                            |
| 8083 | `make dev` (Vite)                                             |

## Backend flags

| Flag                    | Meaning                                                  |
| ----------------------- | -------------------------------------------------------- |
| `--port`                | Port for RPCs and the client (required)                  |
| `--db`                  | SQLite database file (required)                          |
| `--session_secret`      | File containing the session secret (required)            |
| `--serve_dir`           | Serve the client (Vite build output) from this directory |
| `--user_session_length` | Session lifetime, a Go duration (default `24h`)          |
| `--slow_responses`      | Delay responses, for testing (below)                     |
| `--error_responses`     | Fail RPCs, for testing (below)                           |

The image runs `--port=8080 --serve_dir=/docroot --db=/db/db.sqlite
--session_secret=/secret/session_secret.txt`. To change flags for a stack,
add a `command:` with the full list to `docker/prod.yml` or `docker/dev.yml`
(it replaces the image's arguments).

The testing flags take either one value for every RPC or a comma-separated
list of `method=value` pairs, where the method is the full procedure name:

```sh
--slow_responses=2s
--slow_responses=/xmaslist.ListService/ListLists=3s,/xmaslist.ListService/GetList=500ms
--error_responses=UNAVAILABLE
--error_responses=/xmaslist.ListService/GetList=NOT_FOUND,/xmaslist.ListService/ListListItems=INTERNAL
```

Durations are Go durations; codes are gRPC code names (`NOT_FOUND`,
`PERMISSION_DENIED`, `UNAUTHENTICATED`, `INTERNAL`, ...). A single code
applies to every RPC, including logging in. In development, pass them with
`make run-backend DB=... ARGS=...`.

## Dev stack

`docker/docker-compose-dev` runs the built image locally on
http://localhost:8080 with a database file of your choice and the dev
session secret. Use it to check an image before deploying it; use
`make dev` for day-to-day development (hot reloading, no image build).

```sh
make images
docker/docker-compose-dev --db=dev.sqlite up -d
docker/docker-compose-dev --db=dev.sqlite logs -f
docker/docker-compose-dev --db=dev.sqlite down
```

`--db` names an existing file, which is mounted read-write (changes persist).
`--tag` selects the image tag (default `latest`) and `--port` the host port
(default 8080), e.g.
`docker/docker-compose-dev --db=dev.sqlite --tag=20261005 --port=8090 up -d`. The options
come first; compose arguments follow them. Put a `--` before the compose
arguments if they start with a compose option:
`docker/docker-compose-dev --db=dev.sqlite -- --ansi never up -d`. It's a separate compose project
(`xmaslist_dev`: container `xmaslist_dev_xmaslist`, network
`xmaslist_dev_net`), so it doesn't touch production.

## Troubleshooting

- **`make dev` loads, but logging in fails** and the Vite terminal shows
  `http proxy error ... ECONNREFUSED`: the backend isn't running on port 8082
  (`make run-backend DB=...`), or `XMASLIST_BACKEND` points somewhere else.
- **Stale or missing generated code**: Go errors like
  `no required module provides package github.com/simmonmt/xmaslist/proto/...`,
  TypeScript errors like `Cannot find module './gen/proto/...'`, or the client
  and server disagreeing after a proto change. Run `make gen`, then restart
  `make dev` and `make run-backend`.
- **Port in use**: `failed to listen: ... address already in use` (backend),
  `Error: Port 8083 is already in use` (Vite), or `port is already allocated`
  from compose (e.g. the old envoy container still holding 3400). Find the
  process with `lsof -i :PORT`, or the container with `docker ps`.
- **cgo**: `cgo: C compiler "gcc" not found` when building, or
  `Binary was compiled with 'CGO_ENABLED=0', go-sqlite3 requires cgo` at
  runtime. Install a C compiler (Debian/Ubuntu `build-essential`, macOS
  `xcode-select --install`, Alpine `build-base`) and make sure `CGO_ENABLED`
  isn't `0`.
