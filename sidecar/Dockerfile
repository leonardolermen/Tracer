FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o sidecar ./cmd/sidecar

# ── Final image ───────────────────────────────────────────────────────────────
FROM scratch

COPY --from=builder /app/sidecar /sidecar
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

EXPOSE 8080

ENTRYPOINT ["/sidecar"]
