<#
.SYNOPSIS
    Automation script for the MCP Governance Hub on Windows.

.DESCRIPTION
    Provides a consistent CLI experience for Windows developers parity with the Makefile.

.EXAMPLE
    ./mcp.ps1 up
#>

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("up", "down", "build", "test", "test-functional", "shell", "clean")]
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
        docker compose run --rm mcp-server npm test
    }
    "test-functional" {
        Write-Host "Verifying MCP JSON-RPC protocol initialization..." -ForegroundColor Cyan
        $initJson = '{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"initialize\", \"params\": {\"capabilities\": {}, \"clientInfo\": {\"name\": \"test-client\", \"version\": \"1.0.0\"}, \"protocolVersion\": \"2024-11-05\"}}'
        docker compose run --rm -i mcp-server /bin/bash -c "echo '$initJson' | node dist/index.js"
    }
    "shell" {
        docker compose run --rm mcp-server /bin/bash
    }
    "clean" {
        docker compose down --rmi local --volumes --remove-orphans
    }
}
