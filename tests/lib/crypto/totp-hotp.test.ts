import { describe, it, expect } from "vitest";
import {
  buildOtpAuthUri,
  generateHotp,
  generateTotp,
  parseOtpAuthUri,
  verifyHotp,
  verifyTotp,
} from "../../../lib/crypto/totp-hotp";

const RFC_BASE32_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp-hotp", () => {
  it("generates RFC4226 HOTP values", async () => {
    const expected = [
      "755224",
      "287082",
      "359152",
      "969429",
      "338314",
      "254676",
      "287922",
      "162583",
      "399871",
      "520489",
    ];

    for (let counter = 0; counter < expected.length; counter += 1) {
      const code = await generateHotp(RFC_BASE32_SECRET, counter, {
        digits: 6,
        algorithm: "SHA1",
      });
      expect(code).toBe(expected[counter]);
    }
  });

  it("generates RFC6238 TOTP values", async () => {
    const vectors = [
      { timestamp: 59_000, code: "94287082" },
      { timestamp: 1_111_111_109_000, code: "07081804" },
      { timestamp: 1_111_111_111_000, code: "14050471" },
      { timestamp: 1_234_567_890_000, code: "89005924" },
      { timestamp: 2_000_000_000_000, code: "69279037" },
      { timestamp: 20_000_000_000_000, code: "65353130" },
    ];

    for (const vector of vectors) {
      const result = await generateTotp(RFC_BASE32_SECRET, vector.timestamp, {
        digits: 8,
        algorithm: "SHA1",
        period: 30,
      });
      expect(result.code).toBe(vector.code);
    }
  });

  it("verifies HOTP and TOTP with windows", async () => {
    const hotpToken = await generateHotp(RFC_BASE32_SECRET, 20);
    const hotpResult = await verifyHotp(RFC_BASE32_SECRET, hotpToken, 19, 2, {
      digits: 6,
    });
    expect(hotpResult.valid).toBe(true);
    expect(hotpResult.matchedCounter).toBe(20);

    const now = 1_234_567_890_000;
    const totpToken = (
      await generateTotp(RFC_BASE32_SECRET, now, { digits: 6, period: 30 })
    ).code;
    const totpResult = await verifyTotp(
      RFC_BASE32_SECRET,
      totpToken,
      now + 25_000,
      1,
      { digits: 6, period: 30 },
    );
    expect(totpResult.valid).toBe(true);
  });

  it("builds and parses otpauth URIs", () => {
    const uri = buildOtpAuthUri({
      mode: "totp",
      secret: RFC_BASE32_SECRET,
      issuer: "AutelysT",
      accountName: "alice@example.com",
      digits: 6,
      period: 30,
      algorithm: "SHA1",
    });

    const parsed = parseOtpAuthUri(uri);
    expect(parsed.mode).toBe("totp");
    expect(parsed.secret).toBe(RFC_BASE32_SECRET);
    expect(parsed.issuer).toBe("AutelysT");
    expect(parsed.accountName).toBe("alice@example.com");
    expect(parsed.period).toBe(30);
  });
});
