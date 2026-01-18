import { secp256k1, schnorr as schnorrCurve } from "@noble/curves/secp256k1.js"
import { p256, p384, p521 } from "@noble/curves/nist.js"
import { ed25519 } from "@noble/curves/ed25519.js"
import { ed448 } from "@noble/curves/ed448.js"
import { brainpoolP256r1, brainpoolP384r1, brainpoolP512r1 } from "@noble/curves/misc.js"
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js"
import {
  slh_dsa_sha2_128f,
  slh_dsa_sha2_128s,
  slh_dsa_sha2_192f,
  slh_dsa_sha2_192s,
  slh_dsa_sha2_256f,
  slh_dsa_sha2_256s,
  slh_dsa_shake_128f,
  slh_dsa_shake_128s,
  slh_dsa_shake_192f,
  slh_dsa_shake_192s,
  slh_dsa_shake_256f,
  slh_dsa_shake_256s,
} from "@noble/post-quantum/slh-dsa.js"
import type { ECDSA } from "@noble/curves/abstract/weierstrass.js"
import type { EdDSA } from "@noble/curves/abstract/edwards.js"
import type { Signer } from "@noble/post-quantum/utils.js"
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64"
import { decodeHex, encodeHex } from "@/lib/encoding/hex"

export { secp256k1, schnorrCurve }

export const modeValues = ["sign", "verify"] as const
export type ModeValue = (typeof modeValues)[number]

export const algorithmValues = ["hmac", "rsa", "ecdsa", "eddsa", "schnorr", "ml-dsa", "slh-dsa"] as const
export type AlgorithmValue = (typeof algorithmValues)[number]

export const hmacHashes = ["SHA-256", "SHA-384", "SHA-512"] as const
export type HmacHash = (typeof hmacHashes)[number]

export const rsaSchemes = ["RSASSA-PKCS1-v1_5", "RSA-PSS"] as const
export type RsaScheme = (typeof rsaSchemes)[number]

export const rsaHashes = ["SHA-256", "SHA-384", "SHA-512"] as const
export type RsaHash = (typeof rsaHashes)[number]

export const ecdsaCurves = [
  "secp256k1",
  "P-256",
  "P-384",
  "P-521",
  "brainpoolP256r1",
  "brainpoolP384r1",
  "brainpoolP512r1",
] as const
export type EcdsaCurve = (typeof ecdsaCurves)[number]

export const ecdsaHashes = ["SHA-256", "SHA-384", "SHA-512"] as const
export type EcdsaHash = (typeof ecdsaHashes)[number]

export const eddsaCurves = ["Ed25519", "Ed448"] as const
export type EddsaCurve = (typeof eddsaCurves)[number]

export const pqcDsaVariants = ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"] as const
export type PqcDsaVariant = (typeof pqcDsaVariants)[number]

export const pqcSlhVariants = [
  "SLH-DSA-SHA2-128f",
  "SLH-DSA-SHA2-128s",
  "SLH-DSA-SHA2-192f",
  "SLH-DSA-SHA2-192s",
  "SLH-DSA-SHA2-256f",
  "SLH-DSA-SHA2-256s",
  "SLH-DSA-SHAKE-128f",
  "SLH-DSA-SHAKE-128s",
  "SLH-DSA-SHAKE-192f",
  "SLH-DSA-SHAKE-192s",
  "SLH-DSA-SHAKE-256f",
  "SLH-DSA-SHAKE-256s",
] as const
export type PqcSlhVariant = (typeof pqcSlhVariants)[number]

export const inputEncodings = ["utf8", "base64", "hex", "binary"] as const
export type InputEncoding = (typeof inputEncodings)[number]

export const signatureEncodings = ["base64", "base64url", "hex"] as const
export type SignatureEncoding = (typeof signatureEncodings)[number]

export const keyEncodings = ["utf8", "base64", "hex"] as const
export type KeyEncoding = (typeof keyEncodings)[number]

export const pqcKeyEncodings = ["base64", "base64url", "hex"] as const
export type PqcKeyEncoding = (typeof pqcKeyEncodings)[number]

export const encodingLabels = {
  utf8: "UTF-8",
  base64: "Base64",
  base64url: "Base64url",
  hex: "Hex",
  binary: "Binary",
} as const

export const ecdsaCurveMap: Record<EcdsaCurve, ECDSA> = {
  secp256k1,
  "P-256": p256,
  "P-384": p384,
  "P-521": p521,
  brainpoolP256r1,
  brainpoolP384r1,
  brainpoolP512r1,
}

export const eddsaCurveMap: Record<EddsaCurve, EdDSA> = {
  Ed25519: ed25519,
  Ed448: ed448,
}

export const pqcDsaMap: Record<PqcDsaVariant, Signer> = {
  "ML-DSA-44": ml_dsa44,
  "ML-DSA-65": ml_dsa65,
  "ML-DSA-87": ml_dsa87,
}

export const pqcSlhMap: Record<PqcSlhVariant, Signer> = {
  "SLH-DSA-SHA2-128f": slh_dsa_sha2_128f,
  "SLH-DSA-SHA2-128s": slh_dsa_sha2_128s,
  "SLH-DSA-SHA2-192f": slh_dsa_sha2_192f,
  "SLH-DSA-SHA2-192s": slh_dsa_sha2_192s,
  "SLH-DSA-SHA2-256f": slh_dsa_sha2_256f,
  "SLH-DSA-SHA2-256s": slh_dsa_sha2_256s,
  "SLH-DSA-SHAKE-128f": slh_dsa_shake_128f,
  "SLH-DSA-SHAKE-128s": slh_dsa_shake_128s,
  "SLH-DSA-SHAKE-192f": slh_dsa_shake_192f,
  "SLH-DSA-SHAKE-192s": slh_dsa_shake_192s,
  "SLH-DSA-SHAKE-256f": slh_dsa_shake_256f,
  "SLH-DSA-SHAKE-256s": slh_dsa_shake_256s,
}

const textEncoder = new TextEncoder()

export function randomBytes(length: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generation is unavailable.")
  }
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function randomAsciiString(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = randomBytes(length)
  let value = ""
  for (let i = 0; i < bytes.length; i += 1) {
    value += alphabet[bytes[i] % alphabet.length]
  }
  return value
}

export function decodeInputBytes(value: string, encoding: InputEncoding) {
  if (encoding === "binary") {
    throw new Error("Binary input requires a file upload.")
  }
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value)
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

export function decodeKeyBytes(value: string, encoding: KeyEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value)
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

export function encodeSignatureBytes(bytes: Uint8Array, encoding: SignatureEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  if (encoding === "base64") return encodeBase64(bytes, { urlSafe: false, padding: true })
  return encodeBase64(bytes, { urlSafe: true, padding: false })
}

export function decodeSignatureBytes(value: string, encoding: SignatureEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

export function parseJwk(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{")) return null
  try {
    const jwk = JSON.parse(trimmed)
    if (jwk && typeof jwk === "object" && "kty" in jwk) {
      return jwk as JsonWebKey
    }
  } catch {
    return null
  }
  return null
}

export function extractPemBlock(pem: string) {
  const trimmed = pem.trim()
  if (!trimmed) return null
  const match = trimmed.match(/-----BEGIN ([^-]+)-----([\s\S]+?)-----END \1-----/)
  if (!match) return null
  const label = match[1]
  const body = match[2].replace(/\s+/g, "")
  return { label, body }
}

export function pemToArrayBuffer(pem: string) {
  const block = extractPemBlock(pem)
  if (!block) return null
  const binary = atob(block.body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return { label: block.label, buffer: bytes.buffer }
}

export function toPem(buffer: ArrayBuffer, label: "PUBLIC KEY" | "PRIVATE KEY") {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n")
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}

export function parseExponent(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const num = Number(trimmed)
  if (!Number.isSafeInteger(num) || num <= 0) return null
  const bytes: number[] = []
  let remaining = num
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff)
    remaining = Math.floor(remaining / 256)
  }
  return new Uint8Array(bytes)
}

export function isKeyPair(key: CryptoKey | CryptoKeyPair): key is CryptoKeyPair {
  return "publicKey" in key && "privateKey" in key
}

export function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes, { urlSafe: true, padding: false })
}

export function decodeBase64Url(value: string) {
  return decodeBase64(value)
}

export function padBytes(bytes: Uint8Array, length: number) {
  if (bytes.length === length) return bytes
  if (bytes.length > length) {
    throw new Error("Key length is invalid for the selected curve.")
  }
  const padded = new Uint8Array(length)
  padded.set(bytes, length - bytes.length)
  return padded
}

type PqcKeyPayload = {
  publicKey?: string
  secretKey?: string
  privateKey?: string
  encoding?: string
}

export function parsePqcKeyPayload(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{")) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object") return parsed as PqcKeyPayload
  } catch {
    return null
  }
  return null
}

export function normalizePqcEncoding(value?: string): PqcKeyEncoding | null {
  if (value === "base64" || value === "base64url" || value === "hex") return value
  return null
}

export function decodePqcKeyBytes(value: string, encoding: PqcKeyEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

export function resolvePqcKeyBytes(keyText: string, encoding: PqcKeyEncoding, type: "public" | "private") {
  const trimmed = keyText.trim()
  if (!trimmed) {
    throw new Error(`${type === "public" ? "Public" : "Private"} key is required.`)
  }
  const payload = parsePqcKeyPayload(trimmed)
  if (payload) {
    const keyEncoding = normalizePqcEncoding(payload.encoding) ?? encoding
    const keyValue = type === "public" ? payload.publicKey : payload.secretKey || payload.privateKey
    if (!keyValue) {
      throw new Error(`${type === "public" ? "Public" : "Private"} key is required.`)
    }
    return decodePqcKeyBytes(keyValue, keyEncoding)
  }
  return decodePqcKeyBytes(trimmed, encoding)
}

export function isPemString(value: string) {
  return value.trim().startsWith("-----BEGIN")
}

export function formatSignatureError(err: unknown) {
  if (err instanceof Error) {
    if (err.message.includes("Invalid") || err.message.includes("required")) {
      return err.message
    }
  }
  return "Failed to process signature."
}

export function createEcJwk(curve: EcdsaCurve, publicKey: Uint8Array, privateKey?: Uint8Array) {
  const coordLength = (publicKey.length - 1) / 2
  const x = publicKey.slice(1, 1 + coordLength)
  const y = publicKey.slice(1 + coordLength)
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: curve,
    x: encodeBase64Url(x),
    y: encodeBase64Url(y),
  }
  if (privateKey) {
    jwk.d = encodeBase64Url(privateKey)
  }
  return jwk
}

export function createOkpJwk(curve: EddsaCurve, publicKey: Uint8Array, privateKey?: Uint8Array) {
  const jwk: JsonWebKey = {
    kty: "OKP",
    crv: curve,
    x: encodeBase64Url(publicKey),
  }
  if (privateKey) {
    jwk.d = encodeBase64Url(privateKey)
  }
  return jwk
}

export function encodePqcKey(bytes: Uint8Array) {
  return encodeBase64(bytes, { urlSafe: false, padding: true })
}

export function createPqcPublicKey(algorithm: string, publicKey: Uint8Array) {
  return {
    kty: "PQC",
    alg: algorithm,
    encoding: "base64",
    publicKey: encodePqcKey(publicKey),
  }
}

export function createPqcPrivateKey(algorithm: string, publicKey: Uint8Array, secretKey: Uint8Array) {
  return {
    kty: "PQC",
    alg: algorithm,
    encoding: "base64",
    publicKey: encodePqcKey(publicKey),
    secretKey: encodePqcKey(secretKey),
  }
}

export function supportsPemForCurve(curve: EcdsaCurve) {
  return curve === "P-256" || curve === "P-384" || curve === "P-521"
}

export async function importPemAsJwk({
  keyText,
  algorithm,
  format,
  usages,
}: {
  keyText: string
  algorithm: AlgorithmIdentifier
  format: "public" | "private"
  usages: KeyUsage[]
}) {
  if (!globalThis.crypto?.subtle) return null
  const parsed = pemToArrayBuffer(keyText)
  if (!parsed) return null
  if (format === "public" && !parsed.label.includes("PUBLIC KEY")) return null
  if (format === "private" && !parsed.label.includes("PRIVATE KEY")) return null
  const keyFormat = format === "public" ? "spki" : "pkcs8"
  try {
    const key = await crypto.subtle.importKey(keyFormat, parsed.buffer, algorithm, true, usages)
    return (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey
  } catch {
    return null
  }
}

export async function resolveEcJwk(keyText: string, curve: EcdsaCurve, usage: "sign" | "verify") {
  const jwk = parseJwk(keyText)
  if (jwk) return jwk
  if (!supportsPemForCurve(curve)) return null
  const algorithm = { name: "ECDSA", namedCurve: curve }
  const usages = usage === "sign" ? ["sign"] : ["verify"]
  return importPemAsJwk({ keyText, algorithm, format: usage === "sign" ? "private" : "public", usages })
}

export async function resolveOkpJwk(keyText: string, curve: EddsaCurve, usage: "sign" | "verify") {
  const jwk = parseJwk(keyText)
  if (jwk) return jwk
  const algorithm = { name: curve }
  const usages = usage === "sign" ? ["sign"] : ["verify"]
  return importPemAsJwk({ keyText, algorithm, format: usage === "sign" ? "private" : "public", usages })
}

export async function getEcdsaPrivateKeyBytes(keyText: string, curve: EcdsaCurve) {
  const jwk = await resolveEcJwk(keyText, curve, "sign")
  if (!jwk) {
    throw new Error("Invalid EC key format. Use JWK or PEM (P-256/P-384/P-521).")
  }
  if (!("d" in jwk)) {
    throw new Error("Private EC JWK (with d) is required to sign.")
  }
  const raw = decodeBase64Url(jwk.d as string)
  const length = ecdsaCurveMap[curve].lengths.secretKey ?? raw.length
  return padBytes(raw, length)
}

export async function getEcdsaPublicKeyBytes(keyText: string, curve: EcdsaCurve) {
  const jwk = await resolveEcJwk(keyText, curve, "verify")
  if (!jwk) {
    throw new Error("Invalid EC key format. Use JWK or PEM (P-256/P-384/P-521).")
  }
  if (jwk.x && jwk.y) {
    const x = decodeBase64Url(jwk.x)
    const y = decodeBase64Url(jwk.y)
    const raw = new Uint8Array(1 + x.length + y.length)
    raw[0] = 4
    raw.set(x, 1)
    raw.set(y, 1 + x.length)
    return raw
  }
  if (jwk.d) {
    const secret = await getEcdsaPrivateKeyBytes(JSON.stringify(jwk), curve)
    return ecdsaCurveMap[curve].getPublicKey(secret, false)
  }
  throw new Error("Public EC JWK must include x and y.")
}

export async function getEddsaPrivateKeyBytes(keyText: string, curve: EddsaCurve) {
  const jwk = await resolveOkpJwk(keyText, curve, "sign")
  if (!jwk) {
    throw new Error("Invalid OKP key format. Use JWK (OKP).")
  }
  if (!("d" in jwk)) {
    throw new Error("Private OKP JWK (with d) is required to sign.")
  }
  const raw = decodeBase64Url(jwk.d as string)
  const length = eddsaCurveMap[curve].lengths.secretKey ?? raw.length
  return padBytes(raw, length)
}

export async function getEddsaPublicKeyBytes(keyText: string, curve: EddsaCurve) {
  const jwk = await resolveOkpJwk(keyText, curve, "verify")
  if (!jwk) {
    throw new Error("Invalid OKP key format. Use JWK (OKP).")
  }
  if (jwk.x) {
    const raw = decodeBase64Url(jwk.x)
    const length = eddsaCurveMap[curve].lengths.publicKey ?? raw.length
    return padBytes(raw, length)
  }
  if (jwk.d) {
    const secret = await getEddsaPrivateKeyBytes(JSON.stringify(jwk), curve)
    return eddsaCurveMap[curve].getPublicKey(secret)
  }
  throw new Error("Public OKP JWK must include x.")
}

export async function getSchnorrPrivateKeyBytes(keyText: string) {
  const jwk = await resolveEcJwk(keyText, "secp256k1", "sign")
  if (!jwk) {
    throw new Error("Invalid EC key format. Use JWK (EC secp256k1).")
  }
  if (!("d" in jwk)) {
    throw new Error("Private EC JWK (with d) is required to sign.")
  }
  const raw = decodeBase64Url(jwk.d as string)
  const length = schnorrCurve.lengths.secretKey ?? raw.length
  return padBytes(raw, length)
}

export async function getSchnorrPublicKeyBytes(keyText: string) {
  const jwk = await resolveEcJwk(keyText, "secp256k1", "verify")
  if (!jwk) {
    throw new Error("Invalid EC key format. Use JWK (EC secp256k1).")
  }
  if (jwk.x) {
    const raw = decodeBase64Url(jwk.x)
    const length = schnorrCurve.lengths.publicKey ?? raw.length
    return padBytes(raw, length)
  }
  if (jwk.d) {
    const secret = await getSchnorrPrivateKeyBytes(JSON.stringify(jwk))
    return schnorrCurve.getPublicKey(secret)
  }
  throw new Error("Public EC JWK must include x.")
}

export async function hashMessageBytes(messageBytes: Uint8Array, hash: EcdsaHash) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.")
  }
  const digest = await crypto.subtle.digest(hash, messageBytes)
  return new Uint8Array(digest)
}

export function getHmacKeyLength(hash: HmacHash) {
  if (hash === "SHA-384") return 48
  if (hash === "SHA-512") return 64
  return 32
}

export function getRsaSaltLength(hash: RsaHash, override: number) {
  if (override > 0) return override
  if (hash === "SHA-384") return 48
  if (hash === "SHA-512") return 64
  return 32
}
