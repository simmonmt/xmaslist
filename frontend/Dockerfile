# Frontend image: the Vite-built client served by the Go SPA server. Build from
# the repo root (or use `make images`):
#   docker build -f frontend/Dockerfile -t simmonmt/xmaslist/frontend:latest .

FROM node:26.10.0-trixie AS client
WORKDIR /src
COPY package.json package-lock.json ./
COPY client/gen/package.json client/gen/
COPY tools/ tools/
RUN npm ci
COPY . .
RUN make gen-js && npm run typecheck && npm run build

FROM golang:1.26.8-trixie AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/frontend ./frontend

FROM debian:trixie-20260918-slim
COPY --from=server /out/frontend /frontend
COPY --from=client /src/client/dist /docroot
ENTRYPOINT ["/frontend"]
CMD ["--index_file=index.html", "--serve_dir=/docroot", "--port=8083"]
