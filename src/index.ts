import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResourceHandlers } from "./handlers/resources.js";
import { registerPromptHandlers } from "./handlers/prompts.js";
import { registerToolHandlers } from "./handlers/tools.js";
import { log } from "./logger.js";

/**
 * MCP Governance Hub — Bootstrap
 *
 * This file is intentionally minimal. All handler logic lives in
 * src/handlers/ so each concern is independently testable.
 */

const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? "/projects";

const server = new Server(
  { name: "mcp-governance-hub", version: "1.1.0" },
  { capabilities: { resources: {}, tools: {}, prompts: {} } },
);

registerResourceHandlers(server, PROJECTS_ROOT);
registerPromptHandlers(server);
registerToolHandlers(server, PROJECTS_ROOT);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("info", "server_started", { projectsRoot: PROJECTS_ROOT, version: "1.1.0" });
}

main().catch((err) => {
  log("error", "server_crashed", { error: String(err) });
  process.exit(1);
});
