# Workflow: Standardized Feature Scaffolding

Use this workflow when the user asks to "Build a new feature" or "Create a new module."

## Phase 1: Context Gathering
- Read the current `architecture.md` via MCP resource.
- Analyze existing domain types in the target project.

## Phase 2: Design (ADR)
- Use the `create_adr` tool to document the new feature's design.
- Wait for user approval of the ADR before proceeding.

## Phase 3: Implementation
1. **Types**: Define the data models or core types first.
2. **Logic**: Implement the core business logic.
3. **Tests**: Create the language-appropriate test files immediately.
4. **Docs**: Update the local documentation (e.g. README.md or API docs).

## Phase 4: Validation
- Run the local test suite using the terminal.
- If tests fail, iterate on the code until green.
