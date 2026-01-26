import { describe, it, expect } from "vitest";
import {
  buildPhoneNumberFromJson,
  parsePhoneNumberJson,
  parsePhoneNumberString,
} from "../../../lib/phone-number/phone-number";

describe("phone-number", () => {
  it("parses a valid phone number", () => {
    const result = parsePhoneNumberString("+12025550123", "US");
    expect(result.error).toBeNull();
    const json = JSON.parse(result.json) as { number?: string; country?: string };
    expect(json.number).toBe("+12025550123");
    expect(json.country).toBe("US");
  });

  it("builds a phone number from JSON", () => {
    const input = JSON.stringify({
      country: "US",
      nationalNumber: "2025550123",
    });
    const result = buildPhoneNumberFromJson(input, "US", "E.164");
    expect(result.error).toBeNull();
    expect(result.number).toBe("+12025550123");
  });

  it("returns error for invalid JSON", () => {
    const result = parsePhoneNumberJson("{oops}");
    expect(result.error).toBeTruthy();
  });
});
