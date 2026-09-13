FROM node:22-alpine AS web

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ .
RUN npm run build

FROM golang:1.27-alpine AS server

ARG VERSION=dev
ARG COMMIT=none
ARG DATE=unknown

WORKDIR /src

COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/ .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-s -w \
      -X main.version=${VERSION} \
      -X main.commit=${COMMIT} \
      -X main.buildDate=${DATE}" \
    -o /out/sentrix-server \
    ./cmd/sentrix-server

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=server /out/sentrix-server /app/sentrix-server
COPY --from=web /app/web/dist /app/web
COPY server/migrations /app/migrations

ENV SENTRIX_WEB_DIR=/app/web
ENV SENTRIX_MIGRATIONS_DIR=/app/migrations

USER nonroot

EXPOSE 8080

ENTRYPOINT ["/app/sentrix-server"]
