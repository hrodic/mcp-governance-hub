# Cross-platform Makefile for Unix-based systems (Linux/macOS)
# All commands run inside the Docker container — no local Node.js required.

.PHONY: up down build test test-functional test-coverage typecheck analyze-deps shell clean

# Start the MCP server in the background
up:
	docker compose up -d --build

# Stop the server
down:
	docker compose down

# Rebuild the image without starting
build:
	docker compose build

# Run the full Vitest unit test suite
test:
	docker compose run --rm --build mcp-server node_modules/.bin/vitest run

# Run tests with coverage report
test-coverage:
	docker compose run --rm --build mcp-server node_modules/.bin/vitest run --coverage

# TypeScript type-check without emitting files
typecheck:
	docker compose run --rm --build mcp-server node_modules/.bin/tsc --noEmit

# Run functional MCP protocol smoke test (JSON-RPC initialize handshake)
test-functional:
	@echo "Verifying MCP JSON-RPC protocol initialization..."
	@echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}, "protocolVersion": "2024-11-05"}}' | docker compose run -T --rm --build mcp-server

# Scan all projects for known vulnerabilities via OSV.dev (requires Python 3.8+)
analyze-deps:
	@echo "Running dependency vulnerability scan..."
	docker compose run --rm --build --entrypoint python mcp-server scripts/analyze-deps.py --path /projects

# Generate package-lock.json via Docker (no local Node.js required)
lock:
	docker run --rm -v "$(PWD):/app" -w /app node:22-slim npm install

# Open an interactive shell inside the container for debugging
shell:
	docker compose run --rm mcp-server /bin/bash

# Remove all Docker artifacts (images, volumes, orphans)
clean:
	docker compose down --rmi local --volumes --remove-orphans
