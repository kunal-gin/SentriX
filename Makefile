VERSION := $(shell cat VERSION)
COMMIT ?= $(shell git rev-parse --short HEAD || echo none)
DATE := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

.PHONY: test-server build-web build-server build-agent docker agent-package

test-server:
	cd server && go fmt ./... && go vet ./... && go test ./...

build-web:
	cd web && npm ci && npm run build

build-server:
	cd server && CGO_ENABLED=0 go build \
		-ldflags "-s -w \
			-X main.version=v$(VERSION) \
			-X main.commit=$(COMMIT) \
			-X main.buildDate=$(DATE)" \
		-o ../dist/sentrix-server \
		./cmd/sentrix-server

build-agent:
	cmake -S agent -B agent/build -DCMAKE_BUILD_TYPE=Release
	cmake --build agent/build --config Release

docker:
	docker build \
		--build-arg VERSION=v$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg DATE=$(DATE) \
		-t sentrix/sentrix-server:v$(VERSION) .

agent-package:
	cd agent/build && cpack
