import { decodeBase32, encodeBase32 } from "@/lib/encoding/base32";

export type OtpMode = "totp" | "hotp";
export type OtpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export interface OtpGenerateOptions {
  digits?: number;
  algorithm?: OtpAlgorithm;
}

export interface TotpGenerateOptions extends OtpGenerateOptions {
  period?: number;
}

export interface OtpVerificationResult {
  valid: boolean;
  matchedCounter: number | null;
  delta: number | null;
}

export interface OtpAuthUriOptions {
  mode: OtpMode;
  secret: string;
  issuer?: string;
  accountName?: string;
  digits?: number;
  algorithm?: OtpAlgorithm;
  period?: number;
  counter?: number;
}

export interface ParsedOtpAuthUri {
  mode: OtpMode;
  secret: string;
  issuer: string;
  accountName: string;
  digits: number;
  algorithm: OtpAlgorithm;
  period: number;
  counter: number;
}

const HASH_ALGORITHM_MAP: Record<OtpAlgorithm, string> = {
  SHA1: "SHA-1",
  SHA256: "SHA-256",
  SHA512: "SHA-512",
};

function sanitizeSecret(secret: string): string {
  return secret.trim().replace(/[\s-]/g, "").toUpperCase();
}

function normalizeDigits(digits?: number): number {
  const nextDigits = Number.isFinite(digits) ? Math.trunc(digits as number) : 6;
  if (nextDigits < 6 || nextDigits > 10) {
    throw new Error("Digits must be between 6 and 10.");
  }
  return nextDigits;
}

function normalizeCounter(counter: number): number {
  if (!Number.isFinite(counter) || counter < 0) {
    throw new Error("Counter must be a non-negative number.");
  }
  return Math.trunc(counter);
}

function normalizePeriod(period?: number): number {
  const nextPeriod = Number.isFinite(period)
    ? Math.trunc(period as number)
    : 30;
  if (nextPeriod < 1 || nextPeriod > 86400) {
    throw new Error("Period must be between 1 and 86400 seconds.");
  }
  return nextPeriod;
}

function counterToBytes(counter: number): Uint8Array {
  let value = BigInt(counter);
  const bytes = new Uint8Array(8);

  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }

  return bytes;
}

function truncateHmac(hmac: Uint8Array, digits: number): string {
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

async function computeHmac(
  secretBytes: Uint8Array,
  counter: number,
  algorithm: OtpAlgorithm,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: HASH_ALGORITHM_MAP[algorithm],
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    counterToBytes(counter),
  );
  return new Uint8Array(signature);
}

function decodeSecret(secret: string): Uint8Array {
  const sanitized = sanitizeSecret(secret);
  if (!sanitized) {
    throw new Error("Secret is required.");
  }
  try {
    return decodeBase32(sanitized);
  } catch (error) {
    console.error(error);
    throw new Error("Secret must be a valid Base32 string.");
  }
}

export function generateOtpSecret(byteLength = 20): string {
  const size = Number.isFinite(byteLength) ? Math.trunc(byteLength) : 20;
  if (size < 10 || size > 128) {
    throw new Error("Secret length must be between 10 and 128 bytes.");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return encodeBase32(bytes, { upperCase: true, padding: false });
}

export async function generateHotp(
  secret: string,
  counter: number,
  options: OtpGenerateOptions = {},
): Promise<string> {
  const digits = normalizeDigits(options.digits);
  const algorithm = options.algorithm ?? "SHA1";
  const normalizedCounter = normalizeCounter(counter);
  const secretBytes = decodeSecret(secret);
  const hmac = await computeHmac(secretBytes, normalizedCounter, algorithm);
  return truncateHmac(hmac, digits);
}

export async function generateTotp(
  secret: string,
  timestampMs: number,
  options: TotpGenerateOptions = {},
): Promise<{ code: string; counter: number; secondsRemaining: number }> {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new Error("Timestamp must be a non-negative number.");
  }
  const period = normalizePeriod(options.period);
  const counter = Math.floor(timestampMs / 1000 / period);
  const secondsElapsed = Math.floor(timestampMs / 1000) % period;
  const secondsRemaining = period - secondsElapsed;
  const code = await generateHotp(secret, counter, options);

  return { code, counter, secondsRemaining };
}

export async function verifyHotp(
  secret: string,
  token: string,
  counter: number,
  window = 0,
  options: OtpGenerateOptions = {},
): Promise<OtpVerificationResult> {
  const expectedDigits = normalizeDigits(options.digits);
  const normalizedToken = token.trim();
  if (!new RegExp(`^[0-9]{${expectedDigits}}$`).test(normalizedToken)) {
    return { valid: false, matchedCounter: null, delta: null };
  }

  const center = normalizeCounter(counter);
  const range = Math.max(0, Math.trunc(window));

  for (let delta = -range; delta <= range; delta += 1) {
    const candidateCounter = center + delta;
    if (candidateCounter < 0) {
      continue;
    }
    const candidate = await generateHotp(secret, candidateCounter, options);
    if (candidate === normalizedToken) {
      return { valid: true, matchedCounter: candidateCounter, delta };
    }
  }

  return { valid: false, matchedCounter: null, delta: null };
}

export async function verifyTotp(
  secret: string,
  token: string,
  timestampMs: number,
  window = 1,
  options: TotpGenerateOptions = {},
): Promise<OtpVerificationResult> {
  const period = normalizePeriod(options.period);
  const centerCounter = Math.floor(timestampMs / 1000 / period);
  return verifyHotp(secret, token, centerCounter, window, options);
}

export function buildOtpAuthUri(options: OtpAuthUriOptions): string {
  const mode = options.mode;
  if (mode !== "hotp" && mode !== "totp") {
    throw new Error("Mode must be either totp or hotp.");
  }

  const secret = sanitizeSecret(options.secret);
  if (!secret) {
    throw new Error("Secret is required.");
  }

  const issuer = options.issuer?.trim() ?? "";
  const accountName = options.accountName?.trim() ?? "";
  const safeAccount = accountName || "account";
  const label = issuer ? `${issuer}:${safeAccount}` : safeAccount;
  const digits = normalizeDigits(options.digits);
  const algorithm = options.algorithm ?? "SHA1";
  const period = normalizePeriod(options.period);
  const counter = normalizeCounter(options.counter ?? 0);

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("digits", String(digits));
  params.set("algorithm", algorithm);
  if (issuer) {
    params.set("issuer", issuer);
  }
  if (mode === "totp") {
    params.set("period", String(period));
  } else {
    params.set("counter", String(counter));
  }

  return `otpauth://${mode}/${encodeURIComponent(label)}?${params.toString()}`;
}

export function parseOtpAuthUri(uri: string): ParsedOtpAuthUri {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(uri.trim());
  } catch (error) {
    console.error(error);
    throw new Error("Invalid otpauth URI.");
  }

  if (parsedUrl.protocol !== "otpauth:") {
    throw new Error("URI protocol must be otpauth.");
  }

  const mode = parsedUrl.hostname.toLowerCase();
  if (mode !== "totp" && mode !== "hotp") {
    throw new Error("URI host must be totp or hotp.");
  }

  const rawLabel = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
  const colonIndex = rawLabel.indexOf(":");
  const issuerFromLabel = colonIndex >= 0 ? rawLabel.slice(0, colonIndex) : "";
  const accountFromLabel =
    colonIndex >= 0 ? rawLabel.slice(colonIndex + 1) : rawLabel;

  const query = parsedUrl.searchParams;
  const secret = sanitizeSecret(query.get("secret") ?? "");
  if (!secret) {
    throw new Error("otpauth URI is missing secret.");
  }

  const issuer = (query.get("issuer") ?? issuerFromLabel).trim();
  const accountName = accountFromLabel.trim();

  const digits = normalizeDigits(
    query.get("digits") ? Number(query.get("digits")) : 6,
  );
  const algorithmRaw = (query.get("algorithm") ?? "SHA1").toUpperCase();
  const algorithm = (
    algorithmRaw === "SHA1" ||
    algorithmRaw === "SHA256" ||
    algorithmRaw === "SHA512"
      ? algorithmRaw
      : "SHA1"
  ) as OtpAlgorithm;

  const period = normalizePeriod(
    query.get("period") ? Number(query.get("period")) : 30,
  );
  const counter = normalizeCounter(
    query.get("counter") ? Number(query.get("counter")) : 0,
  );

  return {
    mode,
    secret,
    issuer,
    accountName,
    digits,
    algorithm,
    period,
    counter,
  };
}
