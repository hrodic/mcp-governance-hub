import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { log } from "../logger.js";

/** Maps prompt names to their markdown file paths (relative to cwd). */
const PROMPT_REGISTRY: Record<string, { file: string; description: string }> = {
  feature_scaffolding: {
    file: "prompts/feature-scaffolding.md",
    description: "Standardized workflow for starting a new feature (Design -> Types -> Tests -> Code).",
  },
  security_audit: {
    file: "prompts/security-audit.md",
    description: "Perform a security and compliance sanity check on a project directory.",
  },
};

/**
 * Registers MCP Prompt handlers.
 *
 * Prompts are reusable workflow templates that the AI can invoke to follow
 * a standardized multi-step process.
 */
export function registerPromptHandlers(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: Object.entries(PROMPT_REGISTRY).map(([name, meta]) => ({
        name,
        description: meta.description,
      })),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const name = request.params.name;
    const entry = PROMPT_REGISTRY[name];

    if (!entry) {
      throw new Error(`Prompt not found: ${name}`);
    }

    log("info", "prompt_requested", { prompt: name });

    const filePath = path.join(process.cwd(), entry.file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return {
        description: `Workflow for ${name}`,
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: content },
          },
        ],
      };
    } catch (err) {
      log("error", "prompt_read_failed", { prompt: name, error: String(err) });
      throw new Error(`Failed to read prompt file: ${err}`);
    }
  });
}
