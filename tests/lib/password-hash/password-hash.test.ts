import { describe, it, expect } from "vitest";
import { parseBcryptHash } from "../../../lib/password-hash/bcrypt";
import { parseScryptHash } from "../../../lib/password-hash/scrypt";
import { parseArgon2Hash } from "../../../lib/password-hash/argon2";

describe("password-hash parsers", () => {
  it("parses bcrypt hash", () => {
    const hash = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8N6YuXw7JvFezG6kZZgwyU0YJIUKyG";
    const parsed = parseBcryptHash(hash);
    expect(parsed?.version).toBe("2b");
    expect(parsed?.cost).toBe(10);
  });

  it("parses scrypt hash", () => {
    const hash = "$scrypt$ln=14,r=8,p=1$c2FsdA$c2VjcmV0";
    const parsed = parseScryptHash(hash);
    expect(parsed?.N).toBe(16384);
    expect(parsed?.r).toBe(8);
    expect(parsed?.p).toBe(1);
  });

  it("parses argon2 hash", () => {
    const hash = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$YWJjZGVm";
    const parsed = parseArgon2Hash(hash);
    expect(parsed?.type).toBe("argon2id");
    expect(parsed?.memory).toBe(65536);
    expect(parsed?.time).toBe(3);
    expect(parsed?.parallelism).toBe(4);
  });
});
