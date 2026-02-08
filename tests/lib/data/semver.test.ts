import { describe, expect, it } from "vitest";
import {
  compareSemver,
  evaluateSemverRange,
  incrementSemver,
  sortSemverLines,
} from "../../../lib/data/semver";

describe("semver helpers", () => {
  it("compares two versions", () => {
    const result = compareSemver("1.2.3", "1.2.4");
    expect(result.validA).toBe(true);
    expect(result.validB).toBe(true);
    expect(result.comparison).toBe(-1);
    expect(result.diff).toBe("patch");
  });

  it("evaluates version ranges", () => {
    const result = evaluateSemverRange("1.5.0", "^1.2.0");
    expect(result.validVersion).toBe(true);
    expect(result.validRange).toBe(true);
    expect(result.satisfies).toBe(true);
  });

  it("sorts and separates invalid versions", () => {
    const result = sortSemverLines("1.2.0\nnope\n1.1.9\n1.2.0");
    expect(result.valid).toEqual(["1.1.9", "1.2.0"]);
    expect(result.invalid).toEqual(["nope"]);
  });

  it("increments versions", () => {
    const next = incrementSemver("1.2.3", "minor");
    expect(next).toBe("1.3.0");
  });
});
