/**
 * Structured Logger for the MCP Governance Hub.
 *
 * All output goes to stderr to avoid corrupting the JSON-RPC stdio transport
 * on stdout. Each log entry is a single-line JSON object for easy parsing
 * by observability tooling.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

/**
 * Emits a structured JSON log line to stderr.
 *
 * @example
 * log("info", "tool_invoked", { tool: "create_adr", title: "Use Redis" });
 * log("warn", "validation_failed", { tool: "create_adr", errors: result.error.issues });
 * log("error", "fs_error", { path: "/projects/foo", error: err.message });
 */
export function log(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  console.error(JSON.stringify(entry));
}
