import { describe, it, expect } from "vitest";
import { AdrSchema, generateSlug } from "../src/utils.js";

describe("ADR Validation", () => {
  it("should validate a correct ADR payload", () => {
    const validAdr = {
      title: "Use Vitest for Testing",
      status: "Accepted",
      drivers: ["Speed", "DX"],
      context: "We need a fast testing framework that supports ESM.",
      decision: "We will use Vitest instead of Jest.",
      consequences: {
        positive: ["Faster runs"],
        negative: ["New dependency"]
      }
    };

    const result = AdrSchema.safeParse(validAdr);
    expect(result.success).toBe(true);
  });

  it("should reject an ADR with missing context", () => {
    const invalidAdr = {
      title: "Short",
      status: "Proposed",
      drivers: [],
      context: "Too short", // Schema requires 20+ chars
      decision: "Decided",
      consequences: { positive: [], negative: [] }
    };

    const result = AdrSchema.safeParse(invalidAdr);
    expect(result.success).toBe(false);
  });
});

describe("Slug Generation", () => {
  it("should convert titles to URL-friendly slugs", () => {
    expect(generateSlug("My ADR Title")).toBe("my-adr-title");
    expect(generateSlug("Special @# Characters!")).toBe("special-characters");
    expect(generateSlug("   Leading and Trailing   ")).toBe("leading-and-trailing");
  });
});
