import { scrypt } from "scrypt-js";
import {
  decodeBase64ToBytes,
  encodeBase64NoPadding,
  isPowerOfTwo,
  randomBytes,
  toPositiveInt,
  utf8ToBytes,
} from "./utils";

export type ScryptParams = {
  N: number;
  r: number;
  p: number;
  dkLen: number;
  salt: string;
  saltLength: number;
};

export type ScryptParsed = {
  N: number;
  r: number;
  p: number;
  salt: string;
  hash: string;
};

const phc = require("@phc/format");

export async function hashScrypt(
  password: string,
  params: ScryptParams,
): Promise<string> {
  const N = toPositiveInt(params.N, 16384);
  if (!isPowerOfTwo(N)) {
    throw new Error("N must be a power of two.");
  }
  const r = toPositiveInt(params.r, 8);
  const p = toPositiveInt(params.p, 1);
  const dkLen = toPositiveInt(params.dkLen, 32);

  const salt = params.salt.trim()
    ? utf8ToBytes(params.salt)
    : randomBytes(toPositiveInt(params.saltLength, 16));

  const derived = await scrypt(utf8ToBytes(password), salt, N, r, p, dkLen);

  const ln = Math.round(Math.log2(N));
  const saltBase64 = encodeBase64NoPadding(salt);
  const hashBase64 = encodeBase64NoPadding(derived);

  return phc.serialize({
    id: "scrypt",
    params: { ln, r, p },
    salt: Buffer.from(salt),
    hash: Buffer.from(derived),
  });
}

export async function verifyScrypt(
  password: string,
  hash: string,
): Promise<boolean> {
  const parsed = parseScryptHash(hash);
  if (!parsed) return false;
  try {
    const saltBytes = decodeBase64ToBytes(parsed.salt);
    const hashBytes = decodeBase64ToBytes(parsed.hash);
    const derived = await scrypt(
      utf8ToBytes(password),
      saltBytes,
      parsed.N,
      parsed.r,
      parsed.p,
      hashBytes.length,
    );
    const derivedBase64 = encodeBase64NoPadding(derived);
    return derivedBase64 === parsed.hash;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export function parseScryptHash(hash: string): ScryptParsed | null {
  try {
    const parsed = phc.deserialize(hash);
    if (parsed.id !== "scrypt") return null;
    const { ln, r, p } = parsed.params;
    const N = Number.isFinite(Number(ln)) ? 2 ** Number(ln) : 0;
    return {
      N,
      r: Number(r),
      p: Number(p),
      salt: encodeBase64NoPadding(parsed.salt),
      hash: encodeBase64NoPadding(parsed.hash),
    };
  } catch {
    return null;
  }
}
