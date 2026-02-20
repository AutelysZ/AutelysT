import { describe, expect, it } from "vitest";
import {
  buildJsonPath,
  clampCollapseDepth,
  decodeEscapedStringForDisplay,
  formatJsonForDisplay,
} from "../../../lib/data/json-viewer";

describe("json viewer helpers", () => {
  it("builds JSONPath for object keys and array indexes", () => {
    expect(buildJsonPath(["users", 0, "name"])).toBe("$.users[0].name");
  });

  it("quotes special keys in JSONPath", () => {
    expect(buildJsonPath(["http headers", "x-api-key"])).toBe(
      '$["http headers"]["x-api-key"]',
    );
  });

  it("clamps collapse depth to configured range", () => {
    expect(clampCollapseDepth(0)).toBe(1);
    expect(clampCollapseDepth(99)).toBe(8);
    expect(clampCollapseDepth(4.8)).toBe(4);
    expect(clampCollapseDepth(Number.NaN)).toBe(1);
  });

  it("formats values for display and copy", () => {
    expect(formatJsonForDisplay("text")).toBe('"text"');
    expect(formatJsonForDisplay({ ok: true })).toBe('{\n  "ok": true\n}');
  });

  it("decodes escaped control sequences for multiline display", () => {
    expect(decodeEscapedStringForDisplay("line1\\nline2\\tindented")).toBe(
      "line1\nline2\tindented",
    );
    expect(decodeEscapedStringForDisplay("hello\\u0020world")).toBe(
      "hello world",
    );
  });
});
