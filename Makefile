SHELL := /bin/bash
.SHELLFLAGS := -eo pipefail -c

BUF := node_modules/.bin/buf
# Image tag for `make images`; override with e.g. `make images TAG=20261005`.
TAG := latest
IMAGE := simmonmt/xmaslist:$(TAG)

.PHONY: all deps gen gen-go gen-js build build-go build-client test dev run-backend \
	images clean

all: build

# Native packages (rolldown, lightningcss) are installed for one OS, CPU and
# libc only, so reinstall node_modules when it was installed for another system
# (e.g. a container sharing this directory with the host).
NODE_SYSTEM := $(shell node -p "[process.platform, process.arch, process.platform === 'linux' ? (process.report.getReport().header.glibcVersionRuntime ? 'glibc' : 'musl') : ''].filter(Boolean).join('-')")
NODE_MODULES := node_modules/.installed-$(NODE_SYSTEM)

$(NODE_MODULES): package.json package-lock.json
	rm -rf node_modules
	npm ci
	touch $@

deps: $(NODE_MODULES)

gen: gen-go gen-js

gen-go: $(NODE_MODULES)
	rm -rf proto/*/
	$(BUF) generate --template buf.gen.go.yaml

gen-js: $(NODE_MODULES)
	rm -rf client/gen
	$(BUF) generate --template buf.gen.js.yaml

build: build-go build-client

build-go: gen-go
	go build ./...

build-client: gen-js
	npm run typecheck
	npm run build

# Go tests plus vet, TypeScript type checking and formatting checks.
test: gen
	go vet ./...
	go test ./...
	npm run typecheck
	node_modules/.bin/prettier --check "client/*.{ts,tsx}" vite.config.mts

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
