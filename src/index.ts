import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { config } from "dotenv";
import { AdrSchema, generateSlug } from "./utils.js";

// Load environment variables
config();

/**
 * MCP Governance Hub
 * A centralized orchestration point for agentic workflows.
 */
const server = new Server({
  name: "mcp-governance-hub",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  }
});

const PROJECTS_ROOT = process.env.PROJECTS_ROOT || "/projects";

// --- Resources: Context Injection ---
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "mcp://hub/architecture",
        name: "Hub Architecture Definition",
        description: "The core design principles and rules for this agentic ecosystem.",
        mimeType: "text/markdown"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "mcp://hub/architecture") {
    const filePath = path.join(PROJECTS_ROOT, "mcp-governance-hub/docs/architecture.md");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/markdown",
          text: content
        }]
      };
    } catch (err) {
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/plain",
          text: "Architecture documentation not found. Please ensure docs/architecture.md exists."
        }]
      };
    }
  }
  throw new Error(`Resource not found: ${request.params.uri}`);
});

// --- Prompts: Workflow Skills ---
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "feature_scaffolding",
        description: "Standardized workflow for starting a new feature (Design -> Types -> Tests -> Code).",
      },
      {
        name: "security_audit",
        description: "Perform a security and compliance sanity check on a project directory.",
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const name = request.params.name;
  let filename = "";

  if (name === "feature_scaffolding") {
    filename = "prompts/feature-scaffolding.md";
  } else if (name === "security_audit") {
    filename = "prompts/security-audit.md";
  } else {
    throw new Error(`Prompt not found: ${name}`);
  }

  const filePath = path.join(process.cwd(), filename);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return {
      description: `Workflow for ${name}`,
      messages: [
        {
          role: "user",
          content: { type: "text", text: content }
        }
      ]
    };
  } catch (err) {
    throw new Error(`Failed to read prompt file: ${err}`);
  }
});

// --- Tools: Architectural Actions ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_adr",
        description: "Generates a standardized Architecture Decision Record (ADR) file. Use this to document major technical pivots or design choices.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            status: { type: "string", enum: ["Proposed", "Accepted", "Rejected", "Superseded"] },
            drivers: { type: "array", items: { type: "string" } },
            context: { type: "string" },
            decision: { type: "string" },
            alternatives: { type: "array", items: { type: "string" } },
            consequences: {
              type: "object",
              properties: {
                positive: { type: "array", items: { type: "string" } },
                negative: { type: "array", items: { type: "string" } }
              },
              required: ["positive", "negative"]
            },
            targetPath: { 
              type: "string", 
              description: "Relative path from the projects root to save the ADR (e.g. 'my-app/docs/adrs'). Defaults to 'docs/adrs'." 
            },
            notes: { type: "string" }
          },
          required: ["title", "status", "drivers", "context", "decision", "consequences"]
        }
      },
      {
        name: "verify_compliance",
        description: "Scans a file to ensure it adheres to architectural requirements or does not contain restricted patterns.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Relative path to the file to audit." },
            requirements: { type: "array", items: { type: "string" }, description: "Strings or patterns that MUST be present." },
            restrictions: { type: "array", items: { type: "string" }, description: "Strings or patterns that MUST NOT be present." }
          },
          required: ["filePath", "requirements"]
        }
      },
      {
        name: "summarize_workspace",
        description: "Scans the projects root to identify sibling projects and their primary languages/frameworks.",
        inputSchema: { type: "object", properties: {} }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "create_adr") {
    // Validate with Zod
    const result = AdrSchema.safeParse(request.params.arguments);
    if (!result.success) {
      return {
        isError: true,
        content: [{ type: "text", text: `Validation Error: ${result.error.message}` }]
      };
    }

    const adr = result.data;
    // Normalize path and ensure it's within PROJECTS_ROOT for safety
    const safeTargetPath = path.normalize(adr.targetPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const adrDir = path.join(PROJECTS_ROOT, safeTargetPath);
    
    try {
      await fs.mkdir(adrDir, { recursive: true });
      const files = await fs.readdir(adrDir);
      const index = (files.length + 1).toString().padStart(3, "0");
      const filename = `${index}-${generateSlug(adr.title)}.md`;
      const fullPath = path.join(adrDir, filename);

      const content = `# ADR ${index}: ${adr.title}

## Status
${adr.status}

## Context
${adr.context}

## Decision
${adr.decision}

## Consequences
### Positive
${adr.consequences.positive.map(p => `- ${p}`).join("\n")}
### Negative
${adr.consequences.negative.map(n => `- ${n}`).join("\n")}
`;

      await fs.writeFile(fullPath, content, "utf-8");
      return {
        content: [{ type: "text", text: `ADR created successfully at ${fullPath}` }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `File System Error: ${err}` }]
      };
    }
  }

  if (request.params.name === "verify_compliance") {
    const args = request.params.arguments as { filePath: string, requirements: string[], restrictions: string[] };
    const fullPath = path.join(PROJECTS_ROOT, args.filePath);

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const results: string[] = [];
      let isError = false;

      for (const req of args.requirements) {
        if (!content.includes(req)) {
          results.push(`❌ Missing Requirement: "${req}"`);
          isError = true;
        } else {
          results.push(`✅ Found Requirement: "${req}"`);
        }
      }

      for (const res of args.restrictions || []) {
        if (content.includes(res)) {
          results.push(`❌ Restricted Pattern Found: "${res}"`);
          isError = true;
        }
      }

      return {
        isError,
        content: [{ type: "text", text: results.join("\n") }]
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Audit Failed: ${err}` }] };
    }
  }

  if (request.params.name === "summarize_workspace") {
    try {
      const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });
      const projects = entries.filter(e => e.isDirectory() && !e.name.startsWith("."));
      const summary = await Promise.all(projects.map(async p => {
        const pPath = path.join(PROJECTS_ROOT, p.name);
        const files = await fs.readdir(pPath);
        let tech = "Unknown";
        if (files.includes("package.json")) tech = "Node.js/JS/TS";
        else if (files.includes("Cargo.toml")) tech = "Rust";
        else if (files.includes("composer.json")) tech = "PHP";
        else if (files.includes("go.mod")) tech = "Go";
        else if (files.includes("requirements.txt")) tech = "Python";
        return `- **${p.name}** (${tech})`;
      }));

      return {
        content: [{ 
          type: "text", 
          text: `Found the following sibling projects in the workspace:\n${summary.join("\n")}` 
        }]
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Workspace scan failed: ${err}` }] };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

// Start Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Governance Hub running on stdio");
}

main().catch(console.error);
