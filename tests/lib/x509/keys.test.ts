import { describe, it, expect } from "vitest"
import {
  normalizeEcCurveId,
  generateEdKeyPair,
  createEdPrivateKeyPem,
  parseEdPrivateKey,
  generateEcKeyPair,
  createEcPrivateKeyPem,
  parseEcPrivateKey,
} from "../../../lib/x509/keys"

describe("x509 keys", () => {
  it("normalizes EC curve aliases", () => {
    expect(normalizeEcCurveId("secp256r1")).toBe("prime256v1")
    expect(normalizeEcCurveId("P-256")).toBe("prime256v1")
    expect(normalizeEcCurveId("brainpoolP384r1")).toBe("brainpoolP384r1")
    expect(normalizeEcCurveId("unknown-curve")).toBeNull()
  })

  it("round-trips Ed25519 PKCS#8 private keys", () => {
    const { privateKey, publicKey } = generateEdKeyPair("Ed25519")
    const pem = createEdPrivateKeyPem("Ed25519", privateKey)
    const parsed = parseEdPrivateKey(pem, "Ed25519")
    expect(parsed.privateKey).toEqual(privateKey)
    expect(parsed.publicKey).toEqual(publicKey)
  })

  it("round-trips EC PKCS#8 private keys", () => {
    const { privateKey, publicKey } = generateEcKeyPair("prime256v1")
    const pem = createEcPrivateKeyPem("prime256v1", privateKey, publicKey)
    const parsed = parseEcPrivateKey(pem, "prime256v1")
    expect(parsed.privateKey).toEqual(privateKey)
    expect(parsed.publicKey).toEqual(publicKey)
  })
})
