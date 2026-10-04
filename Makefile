SHELL := /bin/bash
.SHELLFLAGS := -eo pipefail -c

BUF := node_modules/.bin/buf
IMAGE := simmonmt/xmaslist:latest

.PHONY: all gen gen-go gen-js build build-go build-client test dev run-backend \
	images clean

all: build

node_modules: package.json package-lock.json
	npm install
	touch node_modules

gen: gen-go gen-js

gen-go: node_modules
	rm -rf proto/*/
	$(BUF) generate --template buf.gen.go.yaml

gen-js: node_modules
	rm -rf client/gen
	$(BUF) generate --template buf.gen.js.yaml

build: build-go build-client

build-go: gen-go
	go build ./...

build-client: gen-js
	npm run typecheck
	npm run build

test: gen-go
	go test ./...

# Vite dev server on port 8083. It proxies RPCs to the backend on port 8082
# (see `run-backend`).
dev: gen-js
	npm run dev

# Backend for `make dev`: make run-backend DB=path/to/db.sqlite [ARGS=...]
run-backend: gen-go
	@if [[ -z "$(DB)" ]] ; then \
		echo "usage: make run-backend DB=path/to/db.sqlite [ARGS=...]" >&2 ; \
		exit 2 ; \
	fi
	go run ./backend --port=8082 --db="$(DB)" \
		--session_secret=docker/dev_session_secret.txt $(ARGS)

images:
	docker build -t $(IMAGE) .

clean:
	rm -rf proto/*/ client/gen client/dist
