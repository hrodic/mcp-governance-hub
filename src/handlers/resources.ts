import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { log } from "../logger.js";

/**
 * Registers MCP Resource handlers.
 *
 * Resources are read-only context injections — the AI retrieves them to
 * understand the governance rules before taking action.
 */
export function registerResourceHandlers(server: Server, projectsRoot: string): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "mcp://hub/architecture",
          name: "Hub Architecture Definition",
          description: "The core design principles and rules for this agentic ecosystem.",
          mimeType: "text/markdown",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    log("info", "resource_read", { uri });

    if (uri === "mcp://hub/architecture") {
      const filePath = path.join(projectsRoot, "mcp-governance-hub/docs/architecture.md");
      try {
        const content = await fs.readFile(filePath, "utf-8");
        return {
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        };
      } catch {
        log("warn", "resource_not_found", { uri, filePath });
        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: "Architecture documentation not found. Please ensure docs/architecture.md exists.",
            },
          ],
        };
      }
    }

    throw new Error(`Resource not found: ${uri}`);
  });
}
