export type JwtAlg =
  | "HS256"
  | "HS384"
  | "HS512"
  | "RS256"
  | "RS384"
  | "RS512"
  | "PS256"
  | "PS384"
  | "PS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "EdDSA"
  | "none"

export interface JwtParsed {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  signingInput: string
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function normalizeBase64(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padLength = normalized.length % 4
  return padLength ? normalized + "=".repeat(4 - padLength) : normalized
}

export function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const base64 = btoa(binary)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function base64UrlEncodeString(value: string) {
  return base64UrlEncodeBytes(textEncoder.encode(value) as Uint8Array<ArrayBuffer>)
}

export function base64UrlDecodeToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = normalizeBase64(input)
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function base64UrlDecodeToString(input: string) {
  return textDecoder.decode(base64UrlDecodeToBytes(input))
}

export function parseJwt(token: string): { parsed?: JwtParsed; error?: string } {
  const trimmed = token.trim()
  if (!trimmed) return { error: "Token is empty." }
  const parts = trimmed.split(".")
  if (parts.length !== 3) return { error: "Token must have three parts separated by dots." }

  try {
    const [headerPart, payloadPart, signature] = parts
    const headerJson = base64UrlDecodeToString(headerPart)
    const payloadJson = base64UrlDecodeToString(payloadPart)
    const header = JSON.parse(headerJson) as Record<string, unknown>
    const payload = JSON.parse(payloadJson) as Record<string, unknown>
    return {
      parsed: {
        header,
        payload,
        signature,
        signingInput: `${headerPart}.${payloadPart}`,
      },
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to parse token." }
  }
}

export function decodeSecret(secret: string, encoding: "utf8" | "base64" | "hex"): Uint8Array<ArrayBuffer> | null {
  if (!secret) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(secret) as Uint8Array<ArrayBuffer>
  if (encoding === "base64") {
    try {
      return base64UrlDecodeToBytes(secret)
    } catch {
      return null
    }
  }
  if (encoding === "hex") {
    const normalized = secret.trim().toLowerCase()
    if (!normalized || normalized.length % 2 !== 0) return null
    if (!/^[0-9a-f]+$/.test(normalized)) return null
    const bytes = new Uint8Array(normalized.length / 2)
    for (let i = 0; i < normalized.length; i += 2) {
      bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16)
    }
    return bytes
  }
  return null
}

function parseJwk(secret: string) {
  const trimmed = secret.trim()
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

function extractPemBlock(pem: string) {
  const trimmed = pem.trim()
  if (!trimmed) return null
  const match = trimmed.match(/-----BEGIN ([^-]+)-----([\s\S]+?)-----END \1-----/)
  if (!match) return null
  const label = match[1]
  const body = match[2].replace(/\s+/g, "")
  return { label, body }
}

function pemToArrayBuffer(pem: string) {
  const block = extractPemBlock(pem)
  if (!block) return null
  const binary = atob(block.body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return { label: block.label, buffer: bytes.buffer }
}

function getHmacHash(alg: JwtAlg) {
  return alg === "HS256" ? "SHA-256" : alg === "HS384" ? "SHA-384" : "SHA-512"
}

function getRsaHash(alg: JwtAlg) {
  return alg === "RS256" || alg === "PS256" ? "SHA-256" : alg === "RS384" || alg === "PS384" ? "SHA-384" : "SHA-512"
}

function getEcdsaHash(alg: JwtAlg) {
  return alg === "ES256" ? "SHA-256" : alg === "ES384" ? "SHA-384" : "SHA-512"
}

function getEcdsaCurve(alg: JwtAlg) {
  return alg === "ES256" ? "P-256" : alg === "ES384" ? "P-384" : "P-521"
}

function isHmacAlg(alg: JwtAlg) {
  return alg.startsWith("HS")
}

function isRsaAlg(alg: JwtAlg) {
  return alg.startsWith("RS")
}

function isRsaPssAlg(alg: JwtAlg) {
  return alg.startsWith("PS")
}

function isEcdsaAlg(alg: JwtAlg) {
  return alg.startsWith("ES")
}

function isEdDsaAlg(alg: JwtAlg) {
  return alg === "EdDSA"
}

async function importAsymmetricKey(secret: string, mode: "sign" | "verify", alg: JwtAlg) {
  const jwk = parseJwk(secret)
  if (jwk) {
    if (mode === "sign" && !("d" in jwk)) return null
    if (isRsaAlg(alg)) {
      return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: { name: getRsaHash(alg) } }, false, [
        mode === "sign" ? "sign" : "verify",
      ])
    }
    if (isRsaPssAlg(alg)) {
      return crypto.subtle.importKey("jwk", jwk, { name: "RSA-PSS", hash: { name: getRsaHash(alg) } }, false, [
        mode === "sign" ? "sign" : "verify",
      ])
    }
    if (isEcdsaAlg(alg)) {
      return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: getEcdsaCurve(alg) }, false, [
        mode === "sign" ? "sign" : "verify",
      ])
    }
    if (isEdDsaAlg(alg)) {
      return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, [
        mode === "sign" ? "sign" : "verify",
      ])
    }
    return null
  }

  const parsed = pemToArrayBuffer(secret)
  if (!parsed) return null

  if (mode === "sign" && !parsed.label.includes("PRIVATE KEY")) return null
  if (mode === "verify" && !parsed.label.includes("PUBLIC KEY") && !parsed.label.includes("PRIVATE KEY")) return null

  if (isRsaAlg(alg)) {
    const name = "RSASSA-PKCS1-v1_5"
    const hash = getRsaHash(alg)
    return crypto.subtle.importKey(
      parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki",
      parsed.buffer,
      { name, hash: { name: hash } },
      false,
      mode === "sign" ? ["sign"] : ["verify"],
    )
  }

  if (isRsaPssAlg(alg)) {
    const name = "RSA-PSS"
    const hash = getRsaHash(alg)
    return crypto.subtle.importKey(
      parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki",
      parsed.buffer,
      { name, hash: { name: hash } },
      false,
      mode === "sign" ? ["sign"] : ["verify"],
    )
  }

  if (isEcdsaAlg(alg)) {
    const name = "ECDSA"
    const namedCurve = getEcdsaCurve(alg)
    return crypto.subtle.importKey(
      parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki",
      parsed.buffer,
      { name, namedCurve },
      false,
      mode === "sign" ? ["sign"] : ["verify"],
    )
  }

  if (isEdDsaAlg(alg)) {
    const name = "Ed25519"
    return crypto.subtle.importKey(
      parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki",
      parsed.buffer,
      { name },
      false,
      mode === "sign" ? ["sign"] : ["verify"],
    )
  }

  return null
}

export async function signJwt(signingInput: string, secretBytes: Uint8Array<ArrayBuffer>, alg: JwtAlg) {
  if (alg === "none") return ""
  const hashName = getHmacHash(alg)
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: { name: hashName },
    },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(signingInput))
  return base64UrlEncodeBytes(new Uint8Array(signature))
}

export async function verifyJwtSignature({
  alg,
  signingInput,
  signature,
  secretBytes,
}: {
  alg: JwtAlg
  signingInput: string
  signature: string
  secretBytes: Uint8Array<ArrayBuffer>
}) {
  if (alg === "none") {
    return signature.length === 0
  }
  const hashName = alg === "HS256" ? "SHA-256" : alg === "HS384" ? "SHA-384" : "SHA-512"
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: { name: hashName },
    },
    false,
    ["verify"],
  )
  const signatureBytes = base64UrlDecodeToBytes(signature)
  return crypto.subtle.verify("HMAC", key, signatureBytes, textEncoder.encode(signingInput))
}

export async function signJwtWithKey({
  alg,
  signingInput,
  secret,
  encoding,
}: {
  alg: JwtAlg
  signingInput: string
  secret: string
  encoding: "utf8" | "base64" | "hex"
}) {
  if (alg === "none") return ""
  if (isHmacAlg(alg)) {
    const secretBytes = decodeSecret(secret, encoding)
    if (!secretBytes) return null
    return signJwt(signingInput, secretBytes, alg)
  }
  const key = await importAsymmetricKey(secret, "sign", alg)
  if (!key) return null
  if (isRsaAlg(alg)) {
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, textEncoder.encode(signingInput))
    return base64UrlEncodeBytes(new Uint8Array(signature))
  }
  if (isRsaPssAlg(alg)) {
    const signature = await crypto.subtle.sign(
      { name: "RSA-PSS", saltLength: alg === "PS256" ? 32 : alg === "PS384" ? 48 : 64 },
      key,
      textEncoder.encode(signingInput),
    )
    return base64UrlEncodeBytes(new Uint8Array(signature))
  }
  if (isEcdsaAlg(alg)) {
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: getEcdsaHash(alg) } },
      key,
      textEncoder.encode(signingInput),
    )
    return base64UrlEncodeBytes(new Uint8Array(signature))
  }
  if (isEdDsaAlg(alg)) {
    const signature = await crypto.subtle.sign("Ed25519", key, textEncoder.encode(signingInput))
    return base64UrlEncodeBytes(new Uint8Array(signature))
  }
  return null
}

export async function verifyJwtSignatureWithKey({
  alg,
  signingInput,
  signature,
  secret,
  encoding,
}: {
  alg: JwtAlg
  signingInput: string
  signature: string
  secret: string
  encoding: "utf8" | "base64" | "hex"
}) {
  if (alg === "none") {
    return signature.length === 0
  }
  if (isHmacAlg(alg)) {
    const secretBytes = decodeSecret(secret, encoding)
    if (!secretBytes) return null
    return verifyJwtSignature({ alg, signingInput, signature, secretBytes })
  }
  const key = await importAsymmetricKey(secret, "verify", alg)
  if (!key) return null
  const signatureBytes = base64UrlDecodeToBytes(signature)
  if (isRsaAlg(alg)) {
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signatureBytes, textEncoder.encode(signingInput))
  }
  if (isRsaPssAlg(alg)) {
    return crypto.subtle.verify(
      { name: "RSA-PSS", saltLength: alg === "PS256" ? 32 : alg === "PS384" ? 48 : 64 },
      key,
      signatureBytes,
      textEncoder.encode(signingInput),
    )
  }
  if (isEcdsaAlg(alg)) {
    return crypto.subtle.verify(
      { name: "ECDSA", hash: { name: getEcdsaHash(alg) } },
      key,
      signatureBytes,
      textEncoder.encode(signingInput),
    )
  }
  if (isEdDsaAlg(alg)) {
    return crypto.subtle.verify("Ed25519", key, signatureBytes, textEncoder.encode(signingInput))
  }
  return null
}
