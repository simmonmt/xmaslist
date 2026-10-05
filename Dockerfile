# The xmaslist image: the backend, which also serves the Vite-built client.
# Build from the repo root (or use `make images`):
#   docker build -t simmonmt/xmaslist:latest .

FROM golang:1.26.8-trixie AS go

# Proto generation needs both Node (buf comes from npm) and Go (protoc-gen-go
# and protoc-gen-connect-go run via `go tool`), so build in the Node image with
# the Go toolchain copied in. The image has gcc, which go-sqlite3 (cgo) needs.
FROM node:26.10.0-trixie AS deps
COPY --from=go /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:$PATH
WORKDIR /src

COPY package.json package-lock.json Makefile ./
RUN make deps

COPY go.mod go.sum ./
RUN go mod download

COPY . .

FROM deps AS client
RUN make gen-js && npm run typecheck && npm run build

FROM deps AS backend
RUN make gen-go && CGO_ENABLED=1 go build -o /out/xmaslist ./backend

FROM debian:trixie-20260918-slim
COPY --from=backend /out/xmaslist /xmaslist
COPY --from=client /src/client/dist /docroot
EXPOSE 8080
ENTRYPOINT ["/xmaslist"]
# The database and session secret paths match the volumes in docker/*.yml.
CMD ["--port=8080", "--serve_dir=/docroot", "--db=/db/db.sqlite", \
     "--session_secret=/secret/session_secret.txt"]
