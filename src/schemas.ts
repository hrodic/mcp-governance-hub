import { z } from "zod";

/**
 * Standard schema for Architecture Decision Records (ADRs).
 * Validates that the AI provides all necessary components for a high-quality record.
 */
export const AdrSchema = z.object({
  title: z.string().min(5, "Title must be descriptive"),
  status: z.enum(["Proposed", "Accepted", "Rejected", "Superseded"]),
  drivers: z.array(z.string()).min(1, "At least one technical driver is required"),
  context: z.string().min(20, "Context must explain the problem statement thoroughly"),
  decision: z.string().min(20, "Decision must clearly state the path taken"),
  alternatives: z.array(z.string()).default([]),
  consequences: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string())
  }),
  targetPath: z.string().default("mcp-governance-hub/docs/adrs"), // Relative to PROJECTS_ROOT
  notes: z.string().optional()
});

/**
 * Schema for the verify_compliance tool.
 * Ensures the AI provides at least one requirement pattern to check for.
 */
export const ComplianceSchema = z.object({
  filePath: z.string().min(1, "File path must not be empty"),
  requirements: z.array(z.string()).min(1, "Specify at least one pattern to check for"),
  restrictions: z.array(z.string()).default([]) // Patterns that MUST NOT be present
});

export type Adr = z.infer<typeof AdrSchema>;
export type Compliance = z.infer<typeof ComplianceSchema>;
