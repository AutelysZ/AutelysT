import { describe, expect, it } from "vitest";
import {
  analyzeSpdxDocument,
  analyzeSpdxExpression,
  detectSpdxInputKind,
} from "../../../lib/data/spdx";

describe("spdx helpers", () => {
  it("analyzes valid SPDX expressions", () => {
    const result = analyzeSpdxExpression("MIT OR Apache-2.0");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.licenseIds).toEqual(["MIT", "Apache-2.0"]);
    expect(result.exceptionIds).toEqual([]);
  });

  it("supports custom LicenseRef expressions", () => {
    const result = analyzeSpdxExpression("MIT AND LicenseRef-Custom");
    expect(result.isValid).toBe(true);
    expect(result.licenseIds).toEqual(["MIT", "LicenseRef-Custom"]);
    expect(result.licenses.some((item) => item.isCustomRef)).toBe(true);
  });

  it("flags invalid SPDX expressions", () => {
    const result = analyzeSpdxExpression("MIT OR");
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("treats special SPDX values as valid", () => {
    const noAssertion = analyzeSpdxExpression("NOASSERTION");
    expect(noAssertion.isValid).toBe(true);
    expect(noAssertion.isSpecialExpression).toBe(true);

    const none = analyzeSpdxExpression("none");
    expect(none.isValid).toBe(true);
    expect(none.expression).toBe("NONE");
  });

  it("analyzes SPDX JSON documents", () => {
    const result = analyzeSpdxDocument(
      JSON.stringify({
        spdxVersion: "SPDX-2.3",
        SPDXID: "SPDXRef-DOCUMENT",
        name: "demo",
        dataLicense: "CC0-1.0",
        packages: [
          {
            name: "alpha",
            SPDXID: "SPDXRef-Package-alpha",
            versionInfo: "1.0.0",
            licenseDeclared: "MIT",
            licenseConcluded: "MIT",
          },
          {
            name: "beta",
            SPDXID: "SPDXRef-Package-beta",
            licenseDeclared: "NOASSERTION",
            licenseConcluded: "GPL-2.0-only WITH Classpath-exception-2.0",
          },
        ],
        files: [
          {
            SPDXID: "SPDXRef-File-a",
            licenseConcluded: "Apache-2.0",
            licenseInfoInFile: ["MIT"],
          },
        ],
        relationships: [
          {
            spdxElementId: "SPDXRef-DOCUMENT",
            relationshipType: "DESCRIBES",
            relatedSpdxElement: "SPDXRef-Package-alpha",
          },
        ],
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.metadata?.packageCount).toBe(2);
    expect(result.metadata?.fileCount).toBe(1);
    expect(result.metadata?.relationshipCount).toBe(1);
    expect(result.invalidExpressions).toEqual([]);
    expect(result.referencedLicenseIds).toContain("MIT");
    expect(result.referencedLicenseIds).toContain("Apache-2.0");
    expect(result.packages[0].name).toBe("alpha");
  });

  it("rejects JSON that is not SPDX-shaped", () => {
    const result = analyzeSpdxDocument(JSON.stringify({ foo: "bar" }));
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("does not look like an SPDX document");
  });

  it("detects input kind for viewer mode", () => {
    expect(detectSpdxInputKind("", "auto")).toBe("empty");
    expect(detectSpdxInputKind('{"spdxVersion":"SPDX-2.3"}', "auto")).toBe(
      "document",
    );
    expect(detectSpdxInputKind("MIT OR Apache-2.0", "auto")).toBe("expression");
    expect(detectSpdxInputKind("MIT", "document")).toBe("document");
  });
});
