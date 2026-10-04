SHELL := /bin/bash
.SHELLFLAGS := -eo pipefail -c

BUF := node_modules/.bin/buf
BACKEND_IMAGE := simmonmt/xmaslist/backend:latest
FRONTEND_IMAGE := simmonmt/xmaslist/frontend:latest

.PHONY: all gen gen-go gen-js build build-go build-client test dev images \
	image-backend image-frontend clean

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

dev: gen-js
	npm run dev

images: image-backend image-frontend

image-backend:
	docker build -f backend/Dockerfile -t $(BACKEND_IMAGE) .

image-frontend:
	docker build -f frontend/Dockerfile -t $(FRONTEND_IMAGE) .

clean:
	rm -rf proto/*/ client/gen client/dist
