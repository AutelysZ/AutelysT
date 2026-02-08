import { describe, expect, it } from "vitest";
import { analyzeHar, parseHarJson } from "../../../lib/data/har-analyzer";

describe("har analyzer", () => {
  const HAR_SAMPLE = JSON.stringify({
    log: {
      entries: [
        {
          time: 120,
          request: { method: "GET", url: "https://a.test/api/a" },
          response: { status: 200, bodySize: 100 },
        },
        {
          time: 450,
          request: { method: "POST", url: "https://a.test/api/b" },
          response: { status: 500, bodySize: 250 },
        },
      ],
    },
  });

  it("parses HAR json", () => {
    const parsed = parseHarJson(HAR_SAMPLE);
    expect(parsed.error).toBeUndefined();
    expect(parsed.har).toBeTruthy();
  });

  it("analyzes entries", () => {
    const { har } = parseHarJson(HAR_SAMPLE);
    const summary = analyzeHar(har);
    expect(summary.totalEntries).toBe(2);
    expect(summary.totalTransferBytes).toBe(350);
    expect(summary.methods.GET).toBe(1);
    expect(summary.statusBuckets["5xx"]).toBe(1);
    expect(summary.slowestRequests[0].timeMs).toBe(450);
  });
});
