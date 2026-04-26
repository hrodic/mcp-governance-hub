import { describe, it, expect } from "vitest";
import { AdrSchema, ComplianceSchema } from "../src/schemas.js";
import { generateSlug, resolveSafePath } from "../src/utils.js";
import path from "path";

// ─────────────────────────────────────────────────────────
// AdrSchema
// ─────────────────────────────────────────────────────────
describe("AdrSchema", () => {
  const validBase = {
    title: "Use Vitest for Testing",
    status: "Accepted",
    drivers: ["Speed", "DX"],
    context: "We need a fast testing framework that supports ESM natively.",
    decision: "We will adopt Vitest instead of Jest for all unit tests.",
    consequences: { positive: ["Faster runs"], negative: ["New dependency"] },
  };

  it("accepts a fully valid payload", () => {
    expect(AdrSchema.safeParse(validBase).success).toBe(true);
  });

  it("applies default targetPath when omitted", () => {
    const result = AdrSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetPath).toBe("mcp-governance-hub/docs/adrs");
    }
  });

  it("applies empty array default for alternatives when omitted", () => {
    const result = AdrSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alternatives).toEqual([]);
    }
  });

  it("accepts optional fields when provided", () => {
    const full = {
      ...validBase,
      alternatives: ["Jest", "Mocha"],
      notes: "Evaluate again in 6 months.",
      targetPath: "my-app/docs/adrs",
    };
    const result = AdrSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("rejects title shorter than 5 characters", () => {
    const result = AdrSchema.safeParse({ ...validBase, title: "ADR" });
    expect(result.success).toBe(false);
  });

  it("rejects context shorter than 20 characters", () => {
    const result = AdrSchema.safeParse({ ...validBase, context: "Too short" });
    expect(result.success).toBe(false);
  });

  it("rejects decision shorter than 20 characters", () => {
    const result = AdrSchema.safeParse({ ...validBase, decision: "We do it." });
    expect(result.success).toBe(false);
  });

  it("rejects empty drivers array", () => {
    const result = AdrSchema.safeParse({ ...validBase, drivers: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status enum value", () => {
    const result = AdrSchema.safeParse({ ...validBase, status: "Drafting" });
    expect(result.success).toBe(false);
  });

  it.each(["Proposed", "Accepted", "Rejected", "Superseded"] as const)(
    "accepts status '%s'",
    (status) => {
      expect(AdrSchema.safeParse({ ...validBase, status }).success).toBe(true);
    },
  );

  it("rejects missing consequences", () => {
    const { consequences: _, ...rest } = validBase;
    const result = AdrSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// ComplianceSchema
// ─────────────────────────────────────────────────────────
describe("ComplianceSchema", () => {
  it("accepts a valid compliance payload", () => {
    const result = ComplianceSchema.safeParse({
      filePath: "my-app/src/auth.ts",
      requirements: ["export function authenticate"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults restrictions to an empty array", () => {
    const result = ComplianceSchema.safeParse({
      filePath: "src/index.ts",
      requirements: ["import"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.restrictions).toEqual([]);
    }
  });

  it("rejects an empty filePath", () => {
    const result = ComplianceSchema.safeParse({
      filePath: "",
      requirements: ["something"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty requirements array", () => {
    const result = ComplianceSchema.safeParse({
      filePath: "src/index.ts",
      requirements: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// generateSlug
// ─────────────────────────────────────────────────────────
describe("generateSlug", () => {
  it("converts a normal title to a slug", () => {
    expect(generateSlug("My ADR Title")).toBe("my-adr-title");
  });

  it("strips special characters", () => {
    expect(generateSlug("Special @# Characters!")).toBe("special-characters");
  });

  it("trims leading and trailing whitespace", () => {
    expect(generateSlug("   Leading and Trailing   ")).toBe("leading-and-trailing");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(generateSlug("Too   Many   Spaces")).toBe("too-many-spaces");
  });

  it("handles already-lowercase slugs", () => {
    expect(generateSlug("use-redis-caching")).toBe("use-redis-caching");
  });

  it("handles numbers in titles", () => {
    expect(generateSlug("ADR 42 Use Node 22")).toBe("adr-42-use-node-22");
  });
});

// ─────────────────────────────────────────────────────────
// resolveSafePath — path traversal protection
// ─────────────────────────────────────────────────────────
describe("resolveSafePath", () => {
  const root = "/projects";

  it("resolves a valid relative path inside root", () => {
    const result = resolveSafePath(root, "my-app/docs/adrs");
    expect(result).toBe(path.resolve(root, "my-app/docs/adrs"));
  });

  it("resolves the root itself when given an empty-ish path segment", () => {
    const result = resolveSafePath(root, "mcp-governance-hub");
    expect(result.startsWith(path.resolve(root))).toBe(true);
  });

  it("blocks a simple ../ traversal", () => {
    expect(() => resolveSafePath(root, "../etc/passwd")).toThrow(
      "Path traversal blocked",
    );
  });

  it("blocks a deep nested traversal", () => {
    expect(() => resolveSafePath(root, "foo/../../etc/shadow")).toThrow(
      "Path traversal blocked",
    );
  });

  it("blocks an absolute path that escapes root", () => {
    expect(() => resolveSafePath(root, "/etc/passwd")).toThrow(
      "Path traversal blocked",
    );
  });

  it("allows a path that stays exactly at root", () => {
    // A path that resolves to /projects itself — edge case
    expect(() => resolveSafePath(root, ".")).not.toThrow();
  });
});
