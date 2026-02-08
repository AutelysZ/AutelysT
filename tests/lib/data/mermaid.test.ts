import { describe, expect, it } from "vitest";
import {
  createMermaidRenderId,
  DEFAULT_MERMAID_SOURCE,
  extractMermaidErrorMessage,
  sanitizeMermaidSource,
} from "../../../lib/data/mermaid";

describe("mermaid helpers", () => {
  it("normalizes source text", () => {
    expect(sanitizeMermaidSource("\tflowchart TD  ")).toBe("flowchart TD");
  });

  it("creates unique render ids", () => {
    const a = createMermaidRenderId();
    const b = createMermaidRenderId();
    expect(a).not.toBe(b);
    expect(a.startsWith("mmd-")).toBe(true);
  });

  it("extracts error text", () => {
    expect(extractMermaidErrorMessage(new Error("boom"))).toBe("boom");
    expect(extractMermaidErrorMessage("x")).toContain("Failed");
  });

  it("has a non-empty sample source", () => {
    expect(DEFAULT_MERMAID_SOURCE.length).toBeGreaterThan(10);
  });
});
