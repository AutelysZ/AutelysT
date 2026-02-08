import { describe, expect, it } from "vitest";
import { analyzeLogs, parseLogLine } from "../../../lib/data/log-analyzer";

describe("log analyzer", () => {
  it("parses common access log lines", () => {
    const line =
      '127.0.0.1 - - [08/Feb/2026:09:00:00 +0000] "GET /api/users HTTP/1.1" 200 123';
    const parsed = parseLogLine(line);
    expect(parsed).toBeTruthy();
    expect(parsed?.method).toBe("GET");
    expect(parsed?.status).toBe(200);
    expect(parsed?.path).toBe("/api/users");
  });

  it("parses JSON log lines", () => {
    const parsed = parseLogLine(
      '{"level":"error","status":500,"path":"/api/login","method":"post"}',
    );
    expect(parsed?.level).toBe("ERROR");
    expect(parsed?.method).toBe("POST");
    expect(parsed?.status).toBe(500);
  });

  it("summarizes mixed logs", () => {
    const input = [
      '127.0.0.1 - - [08/Feb/2026:09:00:00 +0000] "GET /api/users HTTP/1.1" 200 123',
      '{"level":"warn","status":404,"path":"/missing","method":"GET"}',
      "INFO worker started",
    ].join("\n");

    const { summary } = analyzeLogs(input);
    expect(summary.totalLines).toBe(3);
    expect(summary.parsedLines).toBe(3);
    expect(summary.statusBuckets["2xx"]).toBe(1);
    expect(summary.statusBuckets["4xx"]).toBe(1);
  });
});
