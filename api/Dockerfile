FROM golang:1.26-bookworm AS build
WORKDIR /src
ARG VERSION=dev
ARG COMMIT=
ARG BUILD_TIME=
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 go build \
    -ldflags "-s -w -X github.com/tradermemos/api/internal/version.Version=${VERSION} -X github.com/tradermemos/api/internal/version.Commit=${COMMIT} -X github.com/tradermemos/api/internal/version.BuildTime=${BUILD_TIME}" \
    -o /out/server ./cmd/server && \
    CGO_ENABLED=0 go build \
    -ldflags "-s -w -X github.com/tradermemos/api/internal/version.Version=${VERSION} -X github.com/tradermemos/api/internal/version.Commit=${COMMIT} -X github.com/tradermemos/api/internal/version.BuildTime=${BUILD_TIME}" \
    -o /out/tradermemos ./cmd/cli

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/server /server
COPY --from=build /out/tradermemos /tradermemos
EXPOSE 8080
VOLUME ["/data"]
ENV TM_DATABASE_URL=sqlite:///data/tradermemos.db
ENV TM_OCR_ENABLED=false
ENTRYPOINT ["/server"]
