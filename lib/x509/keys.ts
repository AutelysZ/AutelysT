import forge from "node-forge"
import jsrsasign from "jsrsasign"
import { secp256k1 } from "@noble/curves/secp256k1.js"
import { p256, p384, p521 } from "@noble/curves/nist.js"
import { brainpoolP256r1, brainpoolP384r1, brainpoolP512r1 } from "@noble/curves/misc.js"
import { ed25519 } from "@noble/curves/ed25519.js"
import { ed448 } from "@noble/curves/ed448.js"
import { sha1 } from "@noble/hashes/legacy.js"
import { decodeBase64 } from "@/lib/encoding/base64"
import { decodeHex } from "@/lib/encoding/hex"

export type EcCurveId =
  | "prime256v1"
  | "secp384r1"
  | "secp521r1"
  | "secp256k1"
  | "brainpoolP256r1"
  | "brainpoolP384r1"
  | "brainpoolP512r1"

export type EdCurveId = "Ed25519" | "Ed448"

export type DsaParams = {
  p: bigint
  q: bigint
  g: bigint
  y: bigint
  x?: bigint
}

export type DhParams = {
  p: bigint
  g: bigint
  y: bigint
  x?: bigint
}

export type CertPublicKey =
  | { type: "rsa"; n: bigint; e: bigint }
  | { type: "ec"; curve: EcCurveId; publicKeyBytes: Uint8Array }
  | { type: "ed25519" | "ed448"; publicKeyBytes: Uint8Array }
  | { type: "dsa"; params: DsaParams }
  | { type: "dh"; params: DhParams }

const { KEYUTIL, RSAKey, ECDSA, DSA } = jsrsasign

const EC_CURVES: Record<
  EcCurveId,
  {
    oid: string
    jwk: string
    noble: {
      keygen: () => { secretKey: Uint8Array }
      getPublicKey: (secretKey: Uint8Array, isCompressed: boolean) => Uint8Array
      sign: (msg: Uint8Array, privateKey: Uint8Array, opts?: any) => Uint8Array
      lengths: { secretKey?: number }
    }
  }
> = {
  prime256v1: {
    oid: "1.2.840.10045.3.1.7",
    jwk: "P-256",
    noble: p256,
  },
  secp384r1: {
    oid: "1.3.132.0.34",
    jwk: "P-384",
    noble: p384,
  },
  secp521r1: {
    oid: "1.3.132.0.35",
    jwk: "P-521",
    noble: p521,
  },
  secp256k1: {
    oid: "1.3.132.0.10",
    jwk: "secp256k1",
    noble: secp256k1,
  },
  brainpoolP256r1: {
    oid: "1.3.36.3.3.2.8.1.1.7",
    jwk: "brainpoolP256r1",
    noble: brainpoolP256r1,
  },
  brainpoolP384r1: {
    oid: "1.3.36.3.3.2.8.1.1.11",
    jwk: "brainpoolP384r1",
    noble: brainpoolP384r1,
  },
  brainpoolP512r1: {
    oid: "1.3.36.3.3.2.8.1.1.13",
    jwk: "brainpoolP512r1",
    noble: brainpoolP512r1,
  },
}

const EC_CURVE_ALIASES: Record<string, EcCurveId> = {
  "p-256": "prime256v1",
  prime256v1: "prime256v1",
  secp256r1: "prime256v1",
  "p-384": "secp384r1",
  secp384r1: "secp384r1",
  "p-521": "secp521r1",
  secp521r1: "secp521r1",
  secp256k1: "secp256k1",
  brainpoolp256r1: "brainpoolP256r1",
  brainpoolp384r1: "brainpoolP384r1",
  brainpoolp512r1: "brainpoolP512r1",
}

const ED_OIDS: Record<EdCurveId, string> = {
  Ed25519: "1.3.101.112",
  Ed448: "1.3.101.113",
}

export function normalizeEcCurveId(value: string): EcCurveId | null {
  const normalized = value.trim().toLowerCase()
  return EC_CURVE_ALIASES[normalized] ?? null
}

export function getEcCurveSpec(curve: EcCurveId) {
  return EC_CURVES[curve]
}

export function generateEcKeyPair(curve: EcCurveId) {
  const { noble } = getEcCurveSpec(curve)
  const { secretKey } = noble.keygen()
  const publicKey = noble.getPublicKey(secretKey, false)
  return { privateKey: secretKey, publicKey }
}

export function generateEdKeyPair(curve: EdCurveId) {
  const algo = curve === "Ed25519" ? ed25519 : ed448
  const { secretKey, publicKey } = algo.keygen()
  return { privateKey: secretKey, publicKey }
}

export function parseRsaKey(input: string) {
  const key = parseWithKeyutil(input)
  if (!(key instanceof RSAKey)) {
    throw new Error("Invalid RSA key format. Use PEM, DER (Base64), or JWK.")
  }
  const publicKey = {
    type: "rsa" as const,
    n: jsbnToBigInt(key.n),
    e: jsbnToBigInt(key.e),
  }
  const privateKeyPem = KEYUTIL.getPEM(key, "PKCS8PRV")
  return { key, publicKey, privateKeyPem }
}

export function parseEcPrivateKey(input: string, curve: EcCurveId) {
  const jwk = parseJwk(input)
  const spec = getEcCurveSpec(curve)

  if (jwk) {
    const jwkCurve = typeof jwk.crv === "string" ? normalizeEcCurveId(jwk.crv) : null
    if (jwkCurve && jwkCurve !== curve) {
      throw new Error(`EC key curve does not match ${spec.jwk}.`)
    }
    if (jwk.kty && jwk.kty !== "EC") {
      throw new Error("Invalid EC JWK: kty must be EC.")
    }
    if (!jwk.d) {
      throw new Error("Private EC JWK (with d) is required.")
    }
    const privateKey = padBytes(decodeBase64Url(jwk.d), spec.noble.lengths.secretKey)
    let publicKey: Uint8Array
    if (jwk.x && jwk.y) {
      const x = decodeBase64Url(jwk.x)
      const y = decodeBase64Url(jwk.y)
      publicKey = new Uint8Array(1 + x.length + y.length)
      publicKey[0] = 4
      publicKey.set(x, 1)
      publicKey.set(y, 1 + x.length)
    } else {
      publicKey = spec.noble.getPublicKey(privateKey, false)
    }
    return { privateKey, publicKey }
  }

  const key = parseWithKeyutil(input)
  if (!(key instanceof ECDSA)) {
    throw new Error("Invalid EC key format. Use PEM, DER (Base64), or JWK.")
  }
  const keyCurve = normalizeEcCurveId(key.curveName ?? "")
  if (!keyCurve) {
    throw new Error("Unsupported EC curve in provided key.")
  }
  if (keyCurve !== curve) {
    throw new Error(`EC key curve does not match ${spec.jwk}.`)
  }
  if (!key.prvKeyHex) {
    throw new Error("EC private key is required.")
  }
  const privateKey = padBytes(decodeHex(key.prvKeyHex), spec.noble.lengths.secretKey)
  let publicKey = key.pubKeyHex ? decodeHex(key.pubKeyHex) : null
  if (!publicKey) {
    publicKey = spec.noble.getPublicKey(privateKey, false) as Uint8Array<ArrayBuffer>
  }
  return { privateKey, publicKey }
}

export function parseEdPrivateKey(input: string, curve: EdCurveId) {
  const jwk = parseJwk(input)
  const algo = curve === "Ed25519" ? ed25519 : ed448
  const expectedOid = ED_OIDS[curve]

  if (jwk) {
    if (jwk.kty && jwk.kty !== "OKP") {
      throw new Error("Invalid OKP JWK: kty must be OKP.")
    }
    if (jwk.crv && jwk.crv !== curve) {
      throw new Error(`OKP key curve does not match ${curve}.`)
    }
    if (!jwk.d) {
      throw new Error("Private OKP JWK (with d) is required.")
    }
    const privateKey = decodeBase64Url(jwk.d)
    const publicKey = jwk.x ? decodeBase64Url(jwk.x) : algo.getPublicKey(privateKey)
    return { privateKey, publicKey }
  }

  const { oid, privateKey } = parsePkcs8PrivateKey(decodePemOrDer(input))
  if (oid !== expectedOid) {
    throw new Error(`PKCS#8 key is not ${curve}.`)
  }
  const publicKey = algo.getPublicKey(privateKey)
  return { privateKey, publicKey }
}

export function parseDsaPrivateKey(input: string) {
  const jwk = parseJwk(input)
  if (jwk) {
    const params = parseDsaJwk(jwk)
    const key = buildDsaKey(params)
    const privateKeyPem = KEYUTIL.getPEM(key, "PKCS8PRV")
    return { params, key, privateKeyPem }
  }

  const key = parseWithKeyutil(input)
  if (!(key instanceof DSA)) {
    throw new Error("Invalid DSA key format. Use PEM, DER (Base64), or JWK.")
  }
  const params = {
    p: jsbnToBigInt(key.p),
    q: jsbnToBigInt(key.q),
    g: jsbnToBigInt(key.g),
    y: jsbnToBigInt(key.y),
    x: key.x ? jsbnToBigInt(key.x) : undefined,
  }
  const privateKeyPem = KEYUTIL.getPEM(key, "PKCS8PRV")
  return { params, key, privateKeyPem }
}

export function parseDhPrivateKey(input: string) {
  const jwk = parseJwk(input)
  if (!jwk) {
    throw new Error("DH keys must be provided as JSON with p, g, and x values.")
  }
  const params = parseDhJwk(jwk)
  return { params }
}

export function createEcPrivateKeyPem(curve: EcCurveId, privateKey: Uint8Array, publicKey?: Uint8Array) {
  const spec = getEcCurveSpec(curve)
  const privateKeyInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      forge.asn1.integerToDer(0).getBytes(),
    ),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer("1.2.840.10045.2.1").getBytes(),
      ),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer(spec.oid).getBytes(),
      ),
    ]),
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OCTETSTRING,
      false,
      forge.asn1.toDer(createEcPrivateKeyAsn1(privateKey, publicKey)).getBytes(),
    ),
  ])
  return forge.pki.privateKeyInfoToPem(privateKeyInfo)
}

export function createEdPrivateKeyPem(curve: EdCurveId, privateKey: Uint8Array) {
  const privateKeyInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      forge.asn1.integerToDer(0).getBytes(),
    ),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer(ED_OIDS[curve]).getBytes(),
      ),
    ]),
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OCTETSTRING,
      false,
      forge.asn1.toDer(
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OCTETSTRING,
          false,
          bytesToBinaryString(privateKey),
        ),
      ).getBytes(),
    ),
  ])
  return forge.pki.privateKeyInfoToPem(privateKeyInfo)
}

export function createDsaPrivateKeyPem(params: DsaParams) {
  if (!params.x) {
    throw new Error("DSA private key is required.")
  }
  const privateKeyInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      forge.asn1.integerToDer(0).getBytes(),
    ),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer("1.2.840.10040.4.1").getBytes(),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        asn1IntegerFromBigInt(params.p),
        asn1IntegerFromBigInt(params.q),
        asn1IntegerFromBigInt(params.g),
      ]),
    ]),
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OCTETSTRING,
      false,
      forge.asn1.toDer(asn1IntegerFromBigInt(params.x)).getBytes(),
    ),
  ])
  return forge.pki.privateKeyInfoToPem(privateKeyInfo)
}

export function createDhPrivateKeyPem(params: DhParams) {
  if (!params.x) {
    throw new Error("DH private key is required.")
  }
  const privateKeyInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      forge.asn1.integerToDer(0).getBytes(),
    ),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer("1.2.840.113549.1.3.1").getBytes(),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        asn1IntegerFromBigInt(params.p),
        asn1IntegerFromBigInt(params.g),
      ]),
    ]),
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OCTETSTRING,
      false,
      forge.asn1.toDer(asn1IntegerFromBigInt(params.x)).getBytes(),
    ),
  ])
  return forge.pki.privateKeyInfoToPem(privateKeyInfo)
}

export function publicKeyToAsn1(key: CertPublicKey) {
  if (key.type === "rsa") {
    const rsaPublicKey = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      asn1IntegerFromBigInt(key.n),
      asn1IntegerFromBigInt(key.e),
    ])
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer("1.2.840.113549.1.1.1").getBytes(),
        ),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ""),
      ]),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.BITSTRING,
        false,
        String.fromCharCode(0x00) + forge.asn1.toDer(rsaPublicKey).getBytes(),
      ),
    ])
  }

  if (key.type === "ec") {
    const spec = getEcCurveSpec(key.curve)
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer("1.2.840.10045.2.1").getBytes(),
        ),
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer(spec.oid).getBytes(),
        ),
      ]),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.BITSTRING,
        false,
        String.fromCharCode(0x00) + bytesToBinaryString(key.publicKeyBytes),
      ),
    ])
  }

  if (key.type === "ed25519" || key.type === "ed448") {
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer(ED_OIDS[key.type === "ed25519" ? "Ed25519" : "Ed448"]).getBytes(),
        ),
      ]),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.BITSTRING,
        false,
        String.fromCharCode(0x00) + bytesToBinaryString(key.publicKeyBytes),
      ),
    ])
  }

  if (key.type === "dsa") {
    const params = key.params
    const publicInt = forge.asn1.toDer(asn1IntegerFromBigInt(params.y)).getBytes()
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer("1.2.840.10040.4.1").getBytes(),
        ),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
          asn1IntegerFromBigInt(params.p),
          asn1IntegerFromBigInt(params.q),
          asn1IntegerFromBigInt(params.g),
        ]),
      ]),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.BITSTRING,
        false,
        String.fromCharCode(0x00) + publicInt,
      ),
    ])
  }

  if (key.type === "dh") {
    const params = key.params
    const publicInt = forge.asn1.toDer(asn1IntegerFromBigInt(params.y)).getBytes()
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer("1.2.840.113549.1.3.1").getBytes(),
        ),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
          asn1IntegerFromBigInt(params.p),
          asn1IntegerFromBigInt(params.g),
        ]),
      ]),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.BITSTRING,
        false,
        String.fromCharCode(0x00) + publicInt,
      ),
    ])
  }

  throw new Error("Unsupported public key type.")
}

export function computeSubjectKeyIdentifier(spki: any) {
  const der = forge.asn1.toDer(spki).getBytes()
  const digest = sha1(binaryStringToBytes(der))
  return bytesToBinaryString(digest)
}

function parseWithKeyutil(input: string) {
  const trimmed = input.trim()
  const jwk = parseJwk(trimmed)
  if (jwk) {
    return KEYUTIL.getKey(jwk)
  }
  if (trimmed.startsWith("-----BEGIN")) {
    return KEYUTIL.getKey(trimmed)
  }
  const der = decodeBase64(trimmed)
  const hex = forge.util.bytesToHex(bytesToBinaryString(der))
  return KEYUTIL.getKey(hex, null, "pkcs8prv")
}

function parseJwk(input: string): JsonWebKey | null {
  if (!input.startsWith("{")) return null
  try {
    const parsed = JSON.parse(input)
    if (parsed && typeof parsed === "object") return parsed as JsonWebKey
  } catch {
    return null
  }
  return null
}

function parseDsaJwk(jwk: JsonWebKey) {
  const jwkRecord = jwk as Record<string, string | undefined>
  const params = {
    p: decodeFlexibleInt(jwkRecord.p, "p"),
    q: decodeFlexibleInt(jwkRecord.q, "q"),
    g: decodeFlexibleInt(jwkRecord.g, "g"),
    y: jwkRecord.y ? decodeFlexibleInt(jwkRecord.y, "y") : undefined,
    x: jwkRecord.x ? decodeFlexibleInt(jwkRecord.x, "x") : undefined,
  }
  if (!params.x) {
    throw new Error("DSA private key (x) is required.")
  }
  const y = params.y ?? modPow(params.g, params.x, params.p)
  return { p: params.p, q: params.q, g: params.g, x: params.x, y }
}

function parseDhJwk(jwk: JsonWebKey) {
  const jwkRecord = jwk as Record<string, string | undefined>
  const params = {
    p: decodeFlexibleInt(jwkRecord.p, "p"),
    g: decodeFlexibleInt(jwkRecord.g, "g"),
    y: jwkRecord.y ? decodeFlexibleInt(jwkRecord.y, "y") : undefined,
    x: jwkRecord.x ? decodeFlexibleInt(jwkRecord.x, "x") : undefined,
  }
  if (!params.x) {
    throw new Error("DH private key (x) is required.")
  }
  const y = params.y ?? modPow(params.g, params.x, params.p)
  return { p: params.p, g: params.g, x: params.x, y }
}

function decodeFlexibleInt(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} is required.`)
  }
  const trimmed = value.trim()
  const bytes = /^[0-9a-fA-F]+$/.test(trimmed)
    ? decodeHex(trimmed)
    : decodeBase64Url(trimmed)
  return bytesToBigInt(bytes)
}

function parsePkcs8PrivateKey(der: Uint8Array) {
  const asn1 = forge.asn1.fromDer(bytesToBinaryString(der))
  const seq = asn1.value as any[]
  const algId = seq[1]
  const oidNode = (algId.value as any[])[0]
  const oid = forge.asn1.derToOid(oidNode.value as string)
  const privateKeyOctet = seq[2]
  if (privateKeyOctet.type !== forge.asn1.Type.OCTETSTRING) {
    throw new Error("Invalid PKCS#8 private key structure.")
  }
  const inner = forge.asn1.fromDer(privateKeyOctet.value as string)
  if (inner.type !== forge.asn1.Type.OCTETSTRING) {
    throw new Error("Invalid PKCS#8 private key payload.")
  }
  return { oid, privateKey: binaryStringToBytes(inner.value as string) }
}

function createEcPrivateKeyAsn1(privateKey: Uint8Array, publicKey?: Uint8Array) {
  const items: any[] = [
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      forge.asn1.integerToDer(1).getBytes(),
    ),
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OCTETSTRING,
      false,
      bytesToBinaryString(privateKey),
    ),
  ]
  if (publicKey) {
    items.push(
      forge.asn1.create(
        forge.asn1.Class.CONTEXT_SPECIFIC,
        1,
        true,
        [
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.BITSTRING,
            false,
            String.fromCharCode(0x00) + bytesToBinaryString(publicKey),
          ),
        ],
      ),
    )
  }
  return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, items)
}

function asn1IntegerFromBigInt(value: bigint) {
  if (typeof value !== "bigint") {
    throw new Error("Invalid integer value for ASN.1 encoding.")
  }
  let hex = value.toString(16)
  if (hex.length === 0) hex = "0"
  if (hex.length % 2 === 1) hex = `0${hex}`
  let bytes = forge.util.hexToBytes(hex)
  if (!bytes.length) {
    bytes = "\x00"
  }
  if ((bytes.charCodeAt(0) & 0x80) !== 0) {
    bytes = `\x00${bytes}`
  }
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.INTEGER,
    false,
    bytes,
  )
}

function bytesToBinaryString(bytes: Uint8Array) {
  return forge.util.createBuffer(bytes).getBytes()
}

function binaryStringToBytes(value: string) {
  const bytes = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i)
  }
  return bytes
}

function bytesToBigInt(bytes: Uint8Array) {
  const hex = forge.util.bytesToHex(bytesToBinaryString(bytes))
  return hex ? BigInt(`0x${hex}`) : 0n
}

function jsbnToBigInt(value: { toString: (radix: number) => string }) {
  const hex = value.toString(16)
  return hex ? BigInt(`0x${hex}`) : 0n
}

function decodeBase64Url(value: string) {
  return decodeBase64(value.replace(/-/g, "+").replace(/_/g, "/"))
}

function padBytes(bytes: Uint8Array, length?: number) {
  if (!length || bytes.length === length) return bytes
  if (bytes.length > length) {
    throw new Error("Key length is invalid for the selected curve.")
  }
  const padded = new Uint8Array(length)
  padded.set(bytes, length - bytes.length)
  return padded
}

function modPow(base: bigint, exp: bigint, mod: bigint) {
  let result = 1n
  let b = base % mod
  let e = exp
  while (e > 0n) {
    if (e & 1n) {
      result = (result * b) % mod
    }
    e >>= 1n
    b = (b * b) % mod
  }
  return result
}

function buildDsaKey(params: DsaParams) {
  const p = new jsrsasign.BigInteger(params.p.toString(16), 16)
  const q = new jsrsasign.BigInteger(params.q.toString(16), 16)
  const g = new jsrsasign.BigInteger(params.g.toString(16), 16)
  const y = new jsrsasign.BigInteger(params.y.toString(16), 16)
  const x = new jsrsasign.BigInteger((params.x ?? 0n).toString(16), 16)
  const key = new DSA()
  key.setPrivate(p, q, g, y, x)
  return key
}

function decodePemOrDer(input: string) {
  const trimmed = input.trim()
  if (trimmed.startsWith("-----BEGIN")) {
    const decoded = forge.pem.decode(trimmed)
    const message = decoded[0]
    if (!message) {
      throw new Error("Invalid PEM input.")
    }
    return binaryStringToBytes(message.body)
  }
  return decodeBase64(trimmed)
}
