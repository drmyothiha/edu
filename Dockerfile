# Production Distroless container using pre-compiled static Go binaries
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

# Copy statically linked binaries
COPY bin/edu-api /app/edu-api
COPY bin/edu-seed /app/edu-seed

# Copy database schema migrations and seed data
COPY db/migrations /app/db/migrations
COPY schools_with_pcodes.json /app/schools_with_pcodes.json

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/app/edu-api"]
