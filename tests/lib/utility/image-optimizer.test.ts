import { describe, expect, it } from "vitest";
import {
  calculateTargetDimensions,
  clampQuality,
  formatBytes,
} from "../../../lib/utility/image-optimizer";

describe("image optimizer helpers", () => {
  it("clamps quality", () => {
    expect(clampQuality(2)).toBe(1);
    expect(clampQuality(0)).toBe(0.1);
    expect(clampQuality(0.75)).toBe(0.75);
  });

  it("calculates target dimensions while preserving aspect ratio", () => {
    expect(calculateTargetDimensions(4000, 2000, 1000, 1000)).toEqual({
      width: 1000,
      height: 500,
    });
    expect(calculateTargetDimensions(500, 300, 1000, 1000)).toEqual({
      width: 500,
      height: 300,
    });
  });

  it("formats byte sizes", () => {
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(2048)).toContain("KB");
  });
});
