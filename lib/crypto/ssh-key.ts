import { sha256 } from "@noble/hashes/sha2.js";
import { md5 } from "@noble/hashes/legacy.js";
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64";

export type SshKeyType =
  | "ssh-rsa"
  | "ssh-ed25519"
  | "ecdsa-sha2-nistp256"
  | "ecdsa-sha2-nistp384"
  | "ecdsa-sha2-nistp521";

export type ParsedSshPublicKey = {
  type: SshKeyType;
  comment: string | null;
  raw: Uint8Array;
  jwk: JsonWebKey;
  bits: number;
  fingerprintSha256: string;
  fingerprintMd5: string;
};

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const EC_CURVE_MAP: Record<
  string,
  { ssh: SshKeyType; name: string; size: number; bits: number }
> = {
  "P-256": {
    ssh: "ecdsa-sha2-nistp256",
    name: "nistp256",
    size: 32,
    bits: 256,
  },
  "P-384": {
    ssh: "ecdsa-sha2-nistp384",
    name: "nistp384",
    size: 48,
    bits: 384,
  },
  "P-521": {
    ssh: "ecdsa-sha2-nistp521",
    name: "nistp521",
    size: 66,
    bits: 521,
  },
};

const SSH_CURVE_MAP: Record<
  string,
  { crv: "P-256" | "P-384" | "P-521"; size: number; bits: number }
> = {
  nistp256: { crv: "P-256", size: 32, bits: 256 },
  nistp384: { crv: "P-384", size: 48, bits: 384 },
  nistp521: { crv: "P-521", size: 66, bits: 521 },
};

export function parseOpenSshPublicKey(input: string): {
  result?: ParsedSshPublicKey;
  error?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "Public key input is empty." };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    return { error: "OpenSSH public key must contain type and base64 data." };
  }

  const type = parts[0] as SshKeyType;
  if (!isSupportedType(type)) {
    return { error: "Unsupported OpenSSH key type." };
  }

  let raw: Uint8Array;
  try {
    raw = decodeBase64(parts[1]);
  } catch (error) {
    console.error("Failed to decode OpenSSH base64:", error);
    return { error: "Invalid base64 payload for OpenSSH key." };
  }

  const comment = parts.length > 2 ? parts.slice(2).join(" ") : null;

  const parsed = parseOpenSshBlob(raw, type);
  if ("error" in parsed) return { error: parsed.error };

  const fingerprintSha256 = formatSha256Fingerprint(raw);
  const fingerprintMd5 = formatMd5Fingerprint(raw);

  return {
    result: {
      type,
      comment,
      raw,
      jwk: parsed.jwk,
      bits: parsed.bits,
      fingerprintSha256,
      fingerprintMd5,
    },
  };
}

export function encodeOpenSshPublicKey(
  jwk: JsonWebKey,
  comment?: string,
): {
  result?: {
    type: SshKeyType;
    raw: Uint8Array;
    openSsh: string;
    bits: number;
    fingerprintSha256: string;
    fingerprintMd5: string;
  };
  error?: string;
} {
  const built = buildOpenSshBlob(jwk);
  if ("error" in built) return { error: built.error };
  const base64 = encodeBase64(built.raw);
  const openSsh = `${built.type} ${base64}${comment ? ` ${comment}` : ""}`;
  return {
    result: {
      type: built.type,
      raw: built.raw,
      openSsh,
      bits: built.bits,
      fingerprintSha256: formatSha256Fingerprint(built.raw),
      fingerprintMd5: formatMd5Fingerprint(built.raw),
    },
  };
}

export function formatSha256Fingerprint(raw: Uint8Array): string {
  const digest = sha256(raw);
  const base64 = encodeBase64(digest, { padding: false });
  return `SHA256:${base64}`;
}

export function formatMd5Fingerprint(raw: Uint8Array): string {
  const digest = md5(raw);
  const hex = Array.from(digest)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(":");
  return `MD5:${hex}`;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return encodeBase64(bytes, { padding: false, urlSafe: true });
}

export function base64UrlDecode(value: string): Uint8Array {
  return decodeBase64(value);
}

function isSupportedType(type: string): type is SshKeyType {
  return (
    type === "ssh-rsa" ||
    type === "ssh-ed25519" ||
    type === "ecdsa-sha2-nistp256" ||
    type === "ecdsa-sha2-nistp384" ||
    type === "ecdsa-sha2-nistp521"
  );
}

function parseOpenSshBlob(
  raw: Uint8Array,
  declaredType: SshKeyType,
): { jwk: JsonWebKey; bits: number } | { error: string } {
  try {
    let offset = 0;
    const typeValue = readSshString(raw, offset);
    if ("error" in typeValue) return { error: typeValue.error };
    offset = typeValue.offset;
    const type = textDecoder.decode(typeValue.value) as SshKeyType;

    if (type !== declaredType) {
      return { error: "OpenSSH key type does not match payload." };
    }

    if (type === "ssh-rsa") {
      const exponentValue = readSshString(raw, offset);
      if ("error" in exponentValue) return { error: exponentValue.error };
      offset = exponentValue.offset;
      const modulusValue = readSshString(raw, offset);
      if ("error" in modulusValue) return { error: modulusValue.error };

      const e = normalizeMpint(exponentValue.value);
      const n = normalizeMpint(modulusValue.value);
      const bits = bitLength(n);
      return {
        jwk: {
          kty: "RSA",
          n: base64UrlEncode(n),
          e: base64UrlEncode(e),
          ext: true,
        },
        bits,
      };
    }

    if (type === "ssh-ed25519") {
      const keyValue = readSshString(raw, offset);
      if ("error" in keyValue) return { error: keyValue.error };
      const keyBytes = keyValue.value;
      if (keyBytes.length !== 32) {
        return { error: "Ed25519 public key must be 32 bytes." };
      }
      return {
        jwk: {
          kty: "OKP",
          crv: "Ed25519",
          x: base64UrlEncode(keyBytes),
          ext: true,
        },
        bits: 256,
      };
    }

    if (type.startsWith("ecdsa-sha2-")) {
      const curveValue = readSshString(raw, offset);
      if ("error" in curveValue) return { error: curveValue.error };
      offset = curveValue.offset;
      const curveName = textDecoder.decode(curveValue.value);
      if (type !== `ecdsa-sha2-${curveName}`) {
        return { error: "ECDSA curve does not match key type." };
      }
      const curveInfo = SSH_CURVE_MAP[curveName];
      if (!curveInfo) {
        return { error: "Unsupported ECDSA curve." };
      }
      const keyValue = readSshString(raw, offset);
      if ("error" in keyValue) return { error: keyValue.error };
      const keyBytes = keyValue.value;
      if (keyBytes.length !== 1 + curveInfo.size * 2) {
        return { error: "Invalid ECDSA public key length." };
      }
      if (keyBytes[0] !== 0x04) {
        return { error: "ECDSA public key must be uncompressed." };
      }
      const x = keyBytes.slice(1, 1 + curveInfo.size);
      const y = keyBytes.slice(1 + curveInfo.size);
      return {
        jwk: {
          kty: "EC",
          crv: curveInfo.crv,
          x: base64UrlEncode(x),
          y: base64UrlEncode(y),
          ext: true,
        },
        bits: curveInfo.bits,
      };
    }

    return { error: "Unsupported OpenSSH key type." };
  } catch (error) {
    console.error("Failed to parse OpenSSH key blob:", error);
    return { error: "Failed to parse OpenSSH key payload." };
  }
}

function buildOpenSshBlob(
  jwk: JsonWebKey,
): { type: SshKeyType; raw: Uint8Array; bits: number } | { error: string } {
  if (jwk.kty === "RSA") {
    if (!jwk.n || !jwk.e) {
      return { error: "RSA JWK must include modulus and exponent." };
    }
    const n = base64UrlDecode(jwk.n);
    const e = base64UrlDecode(jwk.e);
    const type = "ssh-rsa" satisfies SshKeyType;
    const raw = concatBytes(
      encodeSshString(textEncoder.encode(type)),
      encodeSshString(encodeMpint(e)),
      encodeSshString(encodeMpint(n)),
    );
    return { type, raw, bits: bitLength(n) };
  }

  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    if (!jwk.x) return { error: "Ed25519 JWK must include public key." };
    const keyBytes = base64UrlDecode(jwk.x);
    if (keyBytes.length !== 32) {
      return { error: "Ed25519 public key must be 32 bytes." };
    }
    const type = "ssh-ed25519" satisfies SshKeyType;
    const raw = concatBytes(
      encodeSshString(textEncoder.encode(type)),
      encodeSshString(keyBytes),
    );
    return { type, raw, bits: 256 };
  }

  if (jwk.kty === "EC") {
    if (!jwk.crv || !jwk.x || !jwk.y) {
      return { error: "EC JWK must include curve, x, and y." };
    }
    const curveInfo = EC_CURVE_MAP[jwk.crv];
    if (!curveInfo) {
      return { error: "Unsupported EC curve for SSH." };
    }
    const x = base64UrlDecode(jwk.x);
    const y = base64UrlDecode(jwk.y);
    if (x.length !== curveInfo.size || y.length !== curveInfo.size) {
      return { error: "EC public key coordinate length mismatch." };
    }
    const point = concatBytes(new Uint8Array([0x04]), x, y);
    const type = curveInfo.ssh;
    const raw = concatBytes(
      encodeSshString(textEncoder.encode(type)),
      encodeSshString(textEncoder.encode(curveInfo.name)),
      encodeSshString(point),
    );
    return { type, raw, bits: curveInfo.bits };
  }

  return { error: "Unsupported JWK for OpenSSH encoding." };
}

function encodeSshString(value: Uint8Array): Uint8Array {
  const length = value.length;
  const buffer = new Uint8Array(4 + length);
  const view = new DataView(buffer.buffer);
  view.setUint32(0, length, false);
  buffer.set(value, 4);
  return buffer;
}

function readSshString(
  data: Uint8Array,
  offset: number,
): { value: Uint8Array; offset: number } | { error: string } {
  if (offset + 4 > data.length) {
    return { error: "OpenSSH payload is truncated." };
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const length = view.getUint32(offset, false);
  const start = offset + 4;
  const end = start + length;
  if (end > data.length) {
    return { error: "OpenSSH payload has invalid length." };
  }
  return { value: data.slice(start, end), offset: end };
}

function encodeMpint(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) return new Uint8Array([0]);
  if (bytes[0] & 0x80) {
    const padded = new Uint8Array(bytes.length + 1);
    padded[0] = 0;
    padded.set(bytes, 1);
    return padded;
  }
  return bytes;
}

function normalizeMpint(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 1 && bytes[0] === 0x00) {
    return bytes.slice(1);
  }
  return bytes;
}

function bitLength(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const first = bytes[0];
  let bits = (bytes.length - 1) * 8;
  for (let i = 7; i >= 0; i -= 1) {
    if (first & (1 << i)) {
      bits += i + 1;
      break;
    }
  }
  return bits;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
