<#
.SYNOPSIS
    Automation script for the MCP Governance Hub on Windows.

.DESCRIPTION
    Provides a consistent CLI experience for Windows developers with full
    parity to the Makefile. All commands run inside Docker — no local
    Node.js or Python installation required.

.EXAMPLE
    ./mcp.ps1 up
    ./mcp.ps1 test
    ./mcp.ps1 analyze-deps
#>

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("up", "down", "build", "test", "test-coverage", "test-functional", "typecheck", "analyze-deps", "lock", "shell", "clean")]
    $Action
)

switch ($Action) {
    "up" {
        docker compose up -d --build
    }
    "down" {
        docker compose down
    }
    "build" {
        docker compose build
    }
    "test" {
        docker compose run --rm --build mcp-server node_modules/.bin/vitest run
    }
    "test-coverage" {
        docker compose run --rm --build mcp-server node_modules/.bin/vitest run --coverage
    }
    "typecheck" {
        docker compose run --rm --build mcp-server node_modules/.bin/tsc --noEmit
    }
    "test-functional" {
        Write-Host "Verifying MCP JSON-RPC protocol initialization..." -ForegroundColor Cyan
        $initJson = '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}, "protocolVersion": "2024-11-05"}}'
        $initJson | docker compose run -T --rm --build mcp-server
    }
    "analyze-deps" {
        Write-Host "Running dependency vulnerability scan via OSV.dev..." -ForegroundColor Cyan
        docker compose run --rm --build --entrypoint python mcp-server scripts/analyze-deps.py --path /projects
    }
    "lock" {
        Write-Host "Generating package-lock.json via Docker..." -ForegroundColor Cyan
        $pwd = (Get-Location).Path
        docker run --rm -v "${pwd}:/app" -w /app node:22-slim npm install
        Write-Host "✅ package-lock.json generated. Commit it to the repository." -ForegroundColor Green
    }
    "shell" {
        docker compose run --rm mcp-server /bin/bash
    }
    "clean" {
        docker compose down --rmi local --volumes --remove-orphans
    }
}
