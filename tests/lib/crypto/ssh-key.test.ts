import { describe, it, expect } from "vitest";
import {
  encodeOpenSshPublicKey,
  parseOpenSshPublicKey,
  base64UrlEncode,
} from "../../../lib/crypto/ssh-key";

describe("ssh-key", () => {
  it("round-trips Ed25519 OpenSSH public keys", () => {
    const publicKey = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const jwk: JsonWebKey = {
      kty: "OKP",
      crv: "Ed25519",
      x: base64UrlEncode(publicKey),
    };
    const encoded = encodeOpenSshPublicKey(jwk, "test@example");
    expect(encoded.error).toBeUndefined();

    const parsed = parseOpenSshPublicKey(encoded.result!.openSsh);
    expect(parsed.error).toBeUndefined();
    expect(parsed.result!.type).toBe("ssh-ed25519");
    expect(parsed.result!.jwk.x).toBe(jwk.x);
  });

  it("round-trips RSA OpenSSH public keys", () => {
    const n = new Uint8Array([0x80, 0x01, 0x02, 0x03]);
    const e = new Uint8Array([0x01, 0x00, 0x01]);
    const jwk: JsonWebKey = {
      kty: "RSA",
      n: base64UrlEncode(n),
      e: base64UrlEncode(e),
    };
    const encoded = encodeOpenSshPublicKey(jwk);
    expect(encoded.error).toBeUndefined();

    const parsed = parseOpenSshPublicKey(encoded.result!.openSsh);
    expect(parsed.error).toBeUndefined();
    expect(parsed.result!.type).toBe("ssh-rsa");
    expect(parsed.result!.jwk.n).toBe(jwk.n);
    expect(parsed.result!.bits).toBe(32);
  });
});
