# 🤖 Agent Instructions (MCP Signpost)

> **IMPORTANT**: This project uses a **MCP Governance Hub** for active workflows and architectural governance.

## 🏗️ Architectural Boundary
1.  **Passive Memory**: Project-specific knowledge, types, and local coding styles are co-located in this repository.
2.  **Active Execution**: All multi-step workflows, tool executions, and ADR generation are managed via the **Model Context Protocol (MCP)**.

## 🚀 Instructions for the AI Agent
When working in this repository, you must adopt a **Hybrid Context Strategy**:

1.  **Read Local Rules First**: Always respect the "Passive Memory" rules defined in this `AGENTS.md` file. These take precedence for local stylistic choices (e.g. PHP PSR-12, Rust Idiomatic patterns, or JS Standard style).
2.  **Verify Hub Availability**: Verify that the `mcp-governance-hub` tools and resources are available in your current context. If they are not, stop and instruct the user to configure their MCP client according to the project's README.
3.  **Execute via MCP**: Do not attempt to "guess" how to generate ADRs or technical specs. Use the MCP Tools (`create_adr`) and Prompts (`feature_scaffolding`) provided by the hub.
4.  **Cross-Reference**: If the Hub architecture (`mcp://hub/architecture`) conflicts with a local project rule, ask the user for clarification before proceeding.

## 🚥 Local Rules
- (Add your project-specific "Passive Memory" rules here, e.g., "Use Vitest for testing")
- (Example: "Always keep domain logic in /src/domain")
