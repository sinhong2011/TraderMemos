FROM golang:1.26-bookworm AS build
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends \
    libtesseract-dev \
    libleptonica-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=1 go build -tags tesseract -o /out/server ./cmd/server && \
    CGO_ENABLED=1 go build -tags tesseract -o /out/tradermemos ./cmd/cli

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract5 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/server /server
COPY --from=build /out/tradermemos /tradermemos
EXPOSE 8080
VOLUME ["/data"]
ENV TM_DB_PATH=/data/tradermemos.db
ENV TM_OCR_ENABLED=true
ENV TM_OCR_PROVIDER=tesseract
ENV TM_OCR_LANG=eng
ENTRYPOINT ["/server"]
