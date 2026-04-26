# Contributing to MCP Governance Hub

Thank you for your interest in improving the MCP Governance Hub!

> **No local Node.js or Python required.** All commands run inside Docker.

## Getting Started

1. **Fork & Clone** the repository.
2. **Generate the lockfile** (first time only — no local Node.js required):
   ```bash
   make lock
   # Windows: ./mcp.ps1 lock
   ```
3. **Build the hub**:
   ```bash
   # Linux/macOS
   make build

   # Windows
   ./mcp.ps1 build
   ```
4. **Run the tests**:
   ```bash
   make test
   # Windows: ./mcp.ps1 test
   ```

## How to Add a New Tool

1. Define a Zod schema in `src/schemas.ts`.
2. Add the tool listing entry and handler in `src/handlers/tools.ts`.
3. Write tests in `test/` covering validation acceptance and rejection.
4. Update `README.md` with a usage example.

## How to Add a New Prompt

1. Create a Markdown workflow file in `prompts/`.
2. Register it in the `PROMPT_REGISTRY` map inside `src/handlers/prompts.ts`.
3. The prompt will be automatically listed and retrievable via MCP — no other changes needed.

## Code Style

- TypeScript strict mode is mandatory.
- All tool inputs **must** be validated with Zod — no raw casts.
- Use the `log()` utility in `src/logger.ts` for all output (stdout is reserved for the MCP JSON-RPC stream).
- Run `make typecheck` before submitting a PR.

## Available Commands

| Command | Windows | Description |
|:---|:---|:---|
| `make lock` | `./mcp.ps1 lock` | Generate `package-lock.json` via Docker |
| `make build` | `./mcp.ps1 build` | Build the Docker image |
| `make up` | `./mcp.ps1 up` | Start server in background |
| `make test` | `./mcp.ps1 test` | Run unit tests |
| `make test-coverage` | `./mcp.ps1 test-coverage` | Run tests with coverage report |
| `make typecheck` | `./mcp.ps1 typecheck` | TypeScript type-check only |
| `make test-functional` | `./mcp.ps1 test-functional` | MCP protocol smoke test |
| `make analyze-deps` | `./mcp.ps1 analyze-deps` | OSV.dev vulnerability scan |
| `make shell` | `./mcp.ps1 shell` | Open shell inside container |
| `make clean` | `./mcp.ps1 clean` | Remove all Docker artifacts |

## Testing

Run the full suite inside the container:

```bash
make test
# Windows: ./mcp.ps1 test
```

Run with coverage:

```bash
make test-coverage
# Windows: ./mcp.ps1 test-coverage
```

Run the MCP protocol smoke test:

```bash
make test-functional
# Windows: ./mcp.ps1 test-functional
```

## Pull Requests

- One logical change per PR.
- Include tests for new tools or prompts.
- Ensure `make test` and `make typecheck` pass before requesting a review.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
