import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  evaluateStructuredQuery,
  evaluateXPath,
  formatQueryResult,
} from "../../../lib/data/query-evaluator";

describe("query evaluator", () => {
  it("evaluates JSONPath", () => {
    const result = evaluateStructuredQuery(
      '{"users":[{"id":1},{"id":2}]}',
      "$.users[*].id",
      "jsonpath",
    );
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual([1, 2]);
  });

  it("evaluates JMESPath", () => {
    const result = evaluateStructuredQuery(
      '{"users":[{"id":1},{"id":2}]}',
      "users[].id",
      "jmespath",
    );
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual([1, 2]);
  });

  it("evaluates XPath with DOM globals", () => {
    const dom = new JSDOM("<root><item>one</item><item>two</item></root>", {
      contentType: "text/xml",
    });
    Object.assign(globalThis, {
      DOMParser: dom.window.DOMParser,
      XPathResult: dom.window.XPathResult,
      XMLSerializer: dom.window.XMLSerializer,
      Node: dom.window.Node,
    });

    const result = evaluateXPath(
      "<root><item>one</item><item>two</item></root>",
      "count(/root/item)",
      "number",
    );
    expect(result.error).toBeUndefined();
    expect(result.result).toBe(2);
  });

  it("formats output", () => {
    expect(formatQueryResult(["a", "b"])).toContain("[");
    expect(formatQueryResult("hello")).toBe("hello");
  });
});
