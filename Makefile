# Cross-platform Makefile for Unix-based systems (Linux/macOS)

.PHONY: up down build test test-functional shell clean

# Start the MCP server in the background
up:
	docker compose up -d --build

# Stop the server
down:
	docker compose down

# Rebuild the image
build:
	docker compose build

# Run vitest suite inside the container
test:
	docker compose run --rm mcp-server npm test

# Run functional protocol check
test-functional:
	@echo "Verifying MCP JSON-RPC protocol initialization..."
	@echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}, "protocolVersion": "2024-11-05"}}' | docker compose run --rm -i mcp-server

# Open a shell inside the container
shell:
	docker compose run --rm mcp-server /bin/bash

# Clean up docker artifacts
clean:
	docker compose down --rmi local --volumes --remove-orphans
