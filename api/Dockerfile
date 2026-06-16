FROM golang:1.26 AS build
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server && \
    CGO_ENABLED=0 go build -o /out/tradermemos ./cmd/cli

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/server /server
COPY --from=build /out/tradermemos /tradermemos
EXPOSE 8080
VOLUME ["/data"]
ENV TM_DB_PATH=/data/tradermemos.db
ENTRYPOINT ["/server"]
