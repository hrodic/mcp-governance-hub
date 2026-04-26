import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { AdrSchema, ComplianceSchema } from "../schemas.js";
import { generateSlug, resolveSafePath } from "../utils.js";
import { log } from "../logger.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Registers MCP Tool handlers.
 *
 * Tools are side-effect actions — they mutate the filesystem or perform
 * validated operations that the AI cannot do safely on its own.
 */
export function registerToolHandlers(server: Server, projectsRoot: string): void {
  // --- Tool Listing ---
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "create_adr",
          description:
            "Generates a standardized Architecture Decision Record (ADR) file. Use this to document major technical pivots or design choices.",
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
                  negative: { type: "array", items: { type: "string" } },
                },
                required: ["positive", "negative"],
              },
              targetPath: {
                type: "string",
                description:
                  "Relative path from the projects root to save the ADR (e.g. 'my-app/docs/adrs'). Defaults to 'docs/adrs'.",
              },
              notes: { type: "string" },
            },
            required: ["title", "status", "drivers", "context", "decision", "consequences"],
          },
        },
        {
          name: "verify_compliance",
          description:
            "Scans a file to ensure it adheres to architectural requirements or does not contain restricted patterns.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: { type: "string", description: "Relative path to the file to audit." },
              requirements: {
                type: "array",
                items: { type: "string" },
                description: "Strings or patterns that MUST be present.",
              },
              restrictions: {
                type: "array",
                items: { type: "string" },
                description: "Strings or patterns that MUST NOT be present.",
              },
            },
            required: ["filePath", "requirements"],
          },
        },
        {
          name: "summarize_workspace",
          description:
            "Scans the projects root to identify sibling projects and their primary languages/frameworks.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "analyze_dependencies",
          description:
            "Scans the workspace dependencies (npm, PyPI, Cargo, Go) for known security vulnerabilities using the OSV.dev database.",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    };
  });

  // --- Tool Dispatch ---
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    log("info", "tool_invoked", { tool: toolName });

    switch (toolName) {
      case "create_adr":
        return handleCreateAdr(request.params.arguments, projectsRoot);
      case "verify_compliance":
        return handleVerifyCompliance(request.params.arguments, projectsRoot);
      case "summarize_workspace":
        return handleSummarizeWorkspace(projectsRoot);
      case "analyze_dependencies":
        return handleAnalyzeDependencies(projectsRoot);
      default:
        throw new Error(`Tool not found: ${toolName}`);
    }
  });
}

// ────────────────────────────────────────────────────────────────
// Tool Implementations
// ────────────────────────────────────────────────────────────────

async function handleCreateAdr(
  args: Record<string, unknown> | undefined,
  projectsRoot: string,
) {
  // Validate with Zod
  const result = AdrSchema.safeParse(args);
  if (!result.success) {
    log("warn", "validation_failed", { tool: "create_adr", errors: result.error.issues });
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Validation Error: ${result.error.message}` }],
    };
  }

  const adr = result.data;

  // Path traversal protection
  let adrDir: string;
  try {
    adrDir = resolveSafePath(projectsRoot, adr.targetPath);
  } catch (err) {
    log("error", "path_traversal_blocked", { tool: "create_adr", targetPath: adr.targetPath });
    return {
      isError: true,
      content: [{ type: "text" as const, text: String(err) }],
    };
  }

  try {
    await fs.mkdir(adrDir, { recursive: true });

    // Determine the next ADR index by parsing existing filenames
    const files = await fs.readdir(adrDir);
    const maxIndex = files
      .map((f) => parseInt(f.match(/^(\d+)-/)?.[1] ?? "0", 10))
      .reduce((max, n) => Math.max(max, n), 0);
    const index = (maxIndex + 1).toString().padStart(3, "0");
    const filename = `${index}-${generateSlug(adr.title)}.md`;
    const fullPath = path.join(adrDir, filename);

    // Build the full ADR template including all validated fields
    const sections: string[] = [
      `# ADR ${index}: ${adr.title}`,
      "",
      "## Status",
      adr.status,
      "",
      "## Drivers",
      ...adr.drivers.map((d) => `- ${d}`),
      "",
      "## Context",
      adr.context,
      "",
      "## Decision",
      adr.decision,
    ];

    if (adr.alternatives.length > 0) {
      sections.push("", "## Alternatives Considered", ...adr.alternatives.map((a) => `- ${a}`));
    }

    sections.push(
      "",
      "## Consequences",
      "### Positive",
      ...adr.consequences.positive.map((p) => `- ${p}`),
      "### Negative",
      ...adr.consequences.negative.map((n) => `- ${n}`),
    );

    if (adr.notes) {
      sections.push("", "## Notes", adr.notes);
    }

    sections.push(""); // trailing newline

    await fs.writeFile(fullPath, sections.join("\n"), "utf-8");
    log("info", "adr_created", { path: fullPath, index });

    return {
      content: [{ type: "text" as const, text: `ADR created successfully at ${fullPath}` }],
    };
  } catch (err) {
    log("error", "fs_error", { tool: "create_adr", error: String(err) });
    return {
      isError: true,
      content: [{ type: "text" as const, text: `File System Error: ${err}` }],
    };
  }
}

async function handleVerifyCompliance(
  args: Record<string, unknown> | undefined,
  projectsRoot: string,
) {
  // Validate with Zod
  const result = ComplianceSchema.safeParse(args);
  if (!result.success) {
    log("warn", "validation_failed", { tool: "verify_compliance", errors: result.error.issues });
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Validation Error: ${result.error.message}` }],
    };
  }

  const validated = result.data;

  // Path traversal protection
  let fullPath: string;
  try {
    fullPath = resolveSafePath(projectsRoot, validated.filePath);
  } catch (err) {
    log("error", "path_traversal_blocked", { tool: "verify_compliance", filePath: validated.filePath });
    return {
      isError: true,
      content: [{ type: "text" as const, text: String(err) }],
    };
  }

  try {
    const content = await fs.readFile(fullPath, "utf-8");
    const results: string[] = [];
    let hasFailures = false;

    for (const req of validated.requirements) {
      if (!content.includes(req)) {
        results.push(`❌ Missing Requirement: "${req}"`);
        hasFailures = true;
      } else {
        results.push(`✅ Found Requirement: "${req}"`);
      }
    }

    for (const res of validated.restrictions) {
      if (content.includes(res)) {
        results.push(`❌ Restricted Pattern Found: "${res}"`);
        hasFailures = true;
      }
    }

    log("info", "compliance_checked", {
      tool: "verify_compliance",
      file: fullPath,
      passed: !hasFailures,
    });

    return {
      isError: hasFailures,
      content: [{ type: "text" as const, text: results.join("\n") }],
    };
  } catch (err) {
    log("error", "fs_error", { tool: "verify_compliance", error: String(err) });
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Audit Failed: ${err}` }],
    };
  }
}

/** Mapping of manifest files to their technology stack label. */
const TECH_SIGNATURES: Record<string, string> = {
  "Cargo.toml": "Rust",
  "go.mod": "Go",
  "package.json": "Node.js / JS / TS",
  "composer.json": "PHP",
  "requirements.txt": "Python",
  "pyproject.toml": "Python",
  "Gemfile": "Ruby",
  "pom.xml": "Java (Maven)",
  "build.gradle": "Java / Kotlin (Gradle)",
  "build.gradle.kts": "Kotlin (Gradle KTS)",
  "mix.exs": "Elixir",
  "pubspec.yaml": "Dart / Flutter",
  "CMakeLists.txt": "C / C++ (CMake)",
};

async function handleSummarizeWorkspace(projectsRoot: string) {
  try {
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    const projects = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

    const summary = await Promise.all(
      projects.map(async (p) => {
        const pPath = path.join(projectsRoot, p.name);
        const files = await fs.readdir(pPath);
        let tech = "Unknown";

        for (const [manifest, label] of Object.entries(TECH_SIGNATURES)) {
          if (files.includes(manifest)) {
            tech = label;
            break;
          }
        }

        return `- **${p.name}** (${tech})`;
      }),
    );

    log("info", "workspace_scanned", { projectCount: projects.length });

    return {
      content: [
        {
          type: "text" as const,
          text: `Found the following sibling projects in the workspace:\n${summary.join("\n")}`,
        },
      ],
    };
  } catch (err) {
    log("error", "workspace_scan_failed", { error: String(err) });
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Workspace scan failed: ${err}` }],
    };
  }
}

async function handleAnalyzeDependencies(projectsRoot: string) {
  try {
    log("info", "analyze_deps_started", { projectsRoot });
    const { stdout, stderr } = await execAsync(`python scripts/analyze-deps.py --path "${projectsRoot}"`);
    
    // If the script writes to stderr but exits 0, it might just be warnings
    if (stderr && !stdout) {
      log("warn", "analyze_deps_stderr", { stderr });
    }

    log("info", "analyze_deps_completed", {});
    return {
      content: [{ type: "text" as const, text: stdout || stderr }],
    };
  } catch (err: any) {
    log("error", "analyze_deps_failed", { error: String(err) });
    // python script might exit with 1 if vulnerabilities are found, we still want to return the output
    if (err.stdout) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: err.stdout }],
      };
    }
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Dependency analysis failed: ${err.message || err}` }],
    };
  }
}
