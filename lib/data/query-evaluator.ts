import { JSONPath } from "jsonpath-plus";
import jmespath from "jmespath";

export type StructuredQueryEngine = "jsonpath" | "jmespath";
export type XPathReturnType = "nodeset" | "string" | "number" | "boolean";

export interface QueryEvaluationResult {
  result: unknown;
  error?: string;
}

export function evaluateStructuredQuery(
  inputJson: string,
  query: string,
  engine: StructuredQueryEngine,
): QueryEvaluationResult {
  const jsonText = inputJson.trim();
  const queryText = query.trim();

  if (!jsonText) {
    return { result: null, error: "JSON input is required." };
  }
  if (!queryText) {
    return { result: null, error: "Query is required." };
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (engine === "jsonpath") {
      return { result: JSONPath({ path: queryText, json: parsed }) };
    }
    return { result: jmespath.search(parsed, queryText) };
  } catch (error) {
    console.error(error);
    return {
      result: null,
      error:
        error instanceof Error ? error.message : "Query evaluation failed.",
    };
  }
}

function ensureDomEnvironment() {
  if (
    typeof DOMParser === "undefined" ||
    typeof XPathResult === "undefined" ||
    typeof XMLSerializer === "undefined" ||
    typeof Node === "undefined"
  ) {
    throw new Error("XPath requires a DOM-capable environment.");
  }
}

export function evaluateXPath(
  xmlText: string,
  expression: string,
  returnType: XPathReturnType,
): QueryEvaluationResult {
  if (!xmlText.trim()) {
    return { result: null, error: "XML/HTML input is required." };
  }
  if (!expression.trim()) {
    return { result: null, error: "XPath expression is required." };
  }

  try {
    ensureDomEnvironment();
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(xmlText, "application/xml");
    const parserError = documentNode.querySelector("parsererror");
    if (parserError) {
      return { result: null, error: parserError.textContent || "Invalid XML." };
    }

    if (returnType === "string") {
      const evaluated = documentNode.evaluate(
        expression,
        documentNode,
        null,
        XPathResult.STRING_TYPE,
        null,
      );
      return { result: evaluated.stringValue };
    }

    if (returnType === "number") {
      const evaluated = documentNode.evaluate(
        expression,
        documentNode,
        null,
        XPathResult.NUMBER_TYPE,
        null,
      );
      return { result: evaluated.numberValue };
    }

    if (returnType === "boolean") {
      const evaluated = documentNode.evaluate(
        expression,
        documentNode,
        null,
        XPathResult.BOOLEAN_TYPE,
        null,
      );
      return { result: evaluated.booleanValue };
    }

    const evaluated = documentNode.evaluate(
      expression,
      documentNode,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    const serializer = new XMLSerializer();
    const nodes: string[] = [];
    for (let i = 0; i < evaluated.snapshotLength; i += 1) {
      const node = evaluated.snapshotItem(i);
      if (!node) continue;
      if (node.nodeType === Node.ATTRIBUTE_NODE) {
        nodes.push((node as Attr).value);
      } else if (node.nodeType === Node.TEXT_NODE) {
        nodes.push(node.textContent || "");
      } else {
        nodes.push(serializer.serializeToString(node));
      }
    }
    return { result: nodes };
  } catch (error) {
    console.error(error);
    return {
      result: null,
      error:
        error instanceof Error ? error.message : "XPath evaluation failed.",
    };
  }
}

export function formatQueryResult(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.error(error);
    return String(value);
  }
}
