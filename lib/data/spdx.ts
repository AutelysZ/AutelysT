import parseSpdxExpression from "spdx-expression-parse";
import licenseList from "spdx-license-list/full";

const SPDX_SPECIAL_EXPRESSIONS = new Set(["NONE", "NOASSERTION"]);
const CUSTOM_LICENSE_REF_REGEX =
  /^(?:DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+$/;
const SPDX_LICENSE_KEYS = [
  "dataLicense",
  "licenseConcluded",
  "licenseDeclared",
  "licenseInfoFromFiles",
  "licenseInfoInFile",
] as const;

type LicenseRecord = {
  name: string;
  url: string;
  osiApproved: boolean;
  licenseText: string;
};

type SpdxAstNode = {
  license?: string;
  plus?: true;
  exception?: string;
  conjunction?: "and" | "or";
  left?: SpdxAstNode;
  right?: SpdxAstNode;
};

const LICENSE_DATA = licenseList as Record<string, LicenseRecord>;

export type SpdxViewerMode = "auto" | "expression" | "document";
export type SpdxInputKind = "empty" | "expression" | "document";

export interface SpdxLicenseInfo {
  id: string;
  name: string | null;
  url: string | null;
  osiApproved: boolean | null;
  isCustomRef: boolean;
}

export interface SpdxExpressionAnalysis {
  expression: string;
  isValid: boolean;
  isSpecialExpression: boolean;
  error: string | null;
  ast: SpdxAstNode | null;
  licenseIds: string[];
  exceptionIds: string[];
  licenses: SpdxLicenseInfo[];
  unknownLicenseIds: string[];
}

export interface SpdxPackageSummary {
  name: string;
  spdxId: string | null;
  version: string | null;
  licenseDeclared: string | null;
  licenseConcluded: string | null;
}

export interface SpdxDocumentMetadata {
  spdxVersion: string | null;
  spdxId: string | null;
  name: string | null;
  dataLicense: string | null;
  documentNamespace: string | null;
  created: string | null;
  creators: string[];
  packageCount: number;
  fileCount: number;
  relationshipCount: number;
}

export interface SpdxDocumentAnalysis {
  isValid: boolean;
  error: string | null;
  metadata: SpdxDocumentMetadata | null;
  packages: SpdxPackageSummary[];
  licenseExpressions: SpdxExpressionAnalysis[];
  invalidExpressions: string[];
  referencedLicenseIds: string[];
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractStringValues(entry));
  }

  return [];
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function collectAstIds(
  node: SpdxAstNode | null,
  licenseIds: string[],
  exceptionIds: string[],
) {
  if (!node) return;

  if (typeof node.license === "string") {
    const id = node.plus ? `${node.license}+` : node.license;
    licenseIds.push(id);
  }
  if (typeof node.exception === "string") {
    exceptionIds.push(node.exception);
  }
  if (node.left) {
    collectAstIds(node.left, licenseIds, exceptionIds);
  }
  if (node.right) {
    collectAstIds(node.right, licenseIds, exceptionIds);
  }
}

function normalizeLicenseId(id: string): string {
  return id.endsWith("+") ? `${id.slice(0, -1)}-or-later` : id;
}

function isCustomLicenseRef(id: string): boolean {
  return CUSTOM_LICENSE_REF_REGEX.test(id);
}

function addLicenseExpressionsFromObject(
  source: Record<string, unknown> | null,
  expressions: Set<string>,
) {
  if (!source) return;

  for (const key of SPDX_LICENSE_KEYS) {
    const values = extractStringValues(source[key]);
    for (const value of values) {
      expressions.add(value);
    }
  }
}

export function detectSpdxInputKind(
  input: string,
  mode: SpdxViewerMode,
): SpdxInputKind {
  const trimmed = input.trim();
  if (!trimmed) return "empty";

  if (mode === "expression") return "expression";
  if (mode === "document") return "document";

  return trimmed.startsWith("{") ? "document" : "expression";
}

export function analyzeSpdxExpression(
  expression: string,
): SpdxExpressionAnalysis {
  const trimmed = expression.trim();

  if (!trimmed) {
    return {
      expression: "",
      isValid: false,
      isSpecialExpression: false,
      error: "SPDX expression is required.",
      ast: null,
      licenseIds: [],
      exceptionIds: [],
      licenses: [],
      unknownLicenseIds: [],
    };
  }

  const upper = trimmed.toUpperCase();
  if (SPDX_SPECIAL_EXPRESSIONS.has(upper)) {
    return {
      expression: upper,
      isValid: true,
      isSpecialExpression: true,
      error: null,
      ast: null,
      licenseIds: [],
      exceptionIds: [],
      licenses: [],
      unknownLicenseIds: [],
    };
  }

  try {
    const ast = parseSpdxExpression(trimmed) as unknown as SpdxAstNode;
    const rawLicenseIds: string[] = [];
    const rawExceptionIds: string[] = [];
    collectAstIds(ast, rawLicenseIds, rawExceptionIds);

    const licenseIds = uniqueInOrder(rawLicenseIds);
    const normalizedLicenseIds = uniqueInOrder(
      licenseIds.map((id) => normalizeLicenseId(id)),
    );
    const exceptionIds = uniqueInOrder(rawExceptionIds);
    const licenses: SpdxLicenseInfo[] = [];
    const unknownLicenseIds: string[] = [];

    for (const normalizedId of normalizedLicenseIds) {
      if (isCustomLicenseRef(normalizedId)) {
        licenses.push({
          id: normalizedId,
          name: null,
          url: null,
          osiApproved: null,
          isCustomRef: true,
        });
        continue;
      }

      const match = LICENSE_DATA[normalizedId];
      if (!match) {
        unknownLicenseIds.push(normalizedId);
        continue;
      }

      licenses.push({
        id: normalizedId,
        name: match.name,
        url: match.url,
        osiApproved: Boolean(match.osiApproved),
        isCustomRef: false,
      });
    }

    return {
      expression: trimmed,
      isValid: unknownLicenseIds.length === 0,
      isSpecialExpression: false,
      error: null,
      ast,
      licenseIds: normalizedLicenseIds,
      exceptionIds,
      licenses,
      unknownLicenseIds,
    };
  } catch (error) {
    console.error(error);
    return {
      expression: trimmed,
      isValid: false,
      isSpecialExpression: false,
      error: toErrorMessage(error, "Invalid SPDX expression."),
      ast: null,
      licenseIds: [],
      exceptionIds: [],
      licenses: [],
      unknownLicenseIds: [],
    };
  }
}

export function analyzeSpdxDocument(input: string): SpdxDocumentAnalysis {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "SPDX JSON input is required.",
      metadata: null,
      packages: [],
      licenseExpressions: [],
      invalidExpressions: [],
      referencedLicenseIds: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    console.error(error);
    return {
      isValid: false,
      error: toErrorMessage(error, "Invalid JSON."),
      metadata: null,
      packages: [],
      licenseExpressions: [],
      invalidExpressions: [],
      referencedLicenseIds: [],
    };
  }

  const document = asRecord(parsed);
  if (!document) {
    return {
      isValid: false,
      error: "SPDX document must be a JSON object.",
      metadata: null,
      packages: [],
      licenseExpressions: [],
      invalidExpressions: [],
      referencedLicenseIds: [],
    };
  }

  const packagesRaw = Array.isArray(document.packages) ? document.packages : [];
  const filesRaw = Array.isArray(document.files) ? document.files : [];
  const relationshipsRaw = Array.isArray(document.relationships)
    ? document.relationships
    : [];

  const looksLikeSpdx =
    typeof document.spdxVersion === "string" ||
    typeof document.SPDXID === "string" ||
    typeof document.dataLicense === "string" ||
    packagesRaw.length > 0 ||
    filesRaw.length > 0 ||
    relationshipsRaw.length > 0;

  if (!looksLikeSpdx) {
    return {
      isValid: false,
      error:
        "JSON parsed successfully but does not look like an SPDX document.",
      metadata: null,
      packages: [],
      licenseExpressions: [],
      invalidExpressions: [],
      referencedLicenseIds: [],
    };
  }

  const creationInfo = asRecord(document.creationInfo);
  const creators = Array.isArray(creationInfo?.creators)
    ? creationInfo.creators
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const packageSummaries: SpdxPackageSummary[] = packagesRaw.map(
    (entry, index) => {
      const pkg = asRecord(entry);
      return {
        name: asString(pkg?.name) ?? `Package ${index + 1}`,
        spdxId: asString(pkg?.SPDXID),
        version: asString(pkg?.versionInfo),
        licenseDeclared: asString(pkg?.licenseDeclared),
        licenseConcluded: asString(pkg?.licenseConcluded),
      };
    },
  );

  const expressionSet = new Set<string>();
  addLicenseExpressionsFromObject(document, expressionSet);
  for (const pkg of packagesRaw) {
    addLicenseExpressionsFromObject(asRecord(pkg), expressionSet);
  }
  for (const file of filesRaw) {
    addLicenseExpressionsFromObject(asRecord(file), expressionSet);
  }

  const expressions = Array.from(expressionSet.values());
  const licenseExpressions = expressions.map((value) =>
    analyzeSpdxExpression(value),
  );
  const invalidExpressions = licenseExpressions
    .filter((analysis) => !analysis.isValid)
    .map((analysis) => analysis.expression);
  const referencedLicenseIds = uniqueInOrder(
    licenseExpressions.flatMap((analysis) => analysis.licenseIds),
  );

  return {
    isValid: true,
    error: null,
    metadata: {
      spdxVersion: asString(document.spdxVersion),
      spdxId: asString(document.SPDXID),
      name: asString(document.name),
      dataLicense: asString(document.dataLicense),
      documentNamespace: asString(document.documentNamespace),
      created: asString(creationInfo?.created),
      creators,
      packageCount: packagesRaw.length,
      fileCount: filesRaw.length,
      relationshipCount: relationshipsRaw.length,
    },
    packages: packageSummaries,
    licenseExpressions,
    invalidExpressions,
    referencedLicenseIds,
  };
}
