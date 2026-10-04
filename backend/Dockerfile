# Backend image. Build from the repo root (or use `make images`):
#   docker build -f backend/Dockerfile -t simmonmt/xmaslist/backend:latest .

FROM golang:1.26.8-trixie AS go

# Proto generation needs both Node (buf comes from npm) and Go (protoc-gen-go
# and protoc-gen-connect-go run via `go tool`), so build in the Node image with
# the Go toolchain copied in. The image has gcc, which go-sqlite3 (cgo) needs.
FROM node:26.10.0-trixie AS build
COPY --from=go /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:$PATH
WORKDIR /src

# Only buf is needed from npm here, so skip install scripts (they download the
# browser code generators).
COPY package.json package-lock.json ./
COPY client/gen/package.json client/gen/
RUN npm ci --ignore-scripts

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN make gen-go && CGO_ENABLED=1 go build -o /out/backend ./backend

FROM debian:trixie-20260918-slim
COPY --from=build /out/backend /backend
ENTRYPOINT ["/backend"]
