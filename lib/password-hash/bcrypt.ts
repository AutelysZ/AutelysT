import { compareSync, genSaltSync, hashSync } from "bcryptjs";

export type BcryptParams = {
  rounds: number;
};

export type BcryptParsed = {
  version: string;
  cost: number;
  salt: string;
  hash: string;
};

const bcryptRegex =
  /^\$(2[abxy])\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/;

export function hashBcrypt(password: string, rounds: number): string {
  const safeRounds = Math.min(31, Math.max(4, Math.floor(rounds) || 10));
  const salt = genSaltSync(safeRounds);
  return hashSync(password, salt);
}

export function verifyBcrypt(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

export function parseBcryptHash(hash: string): BcryptParsed | null {
  const trimmed = hash.trim();
  if (!trimmed) return null;
  const match = bcryptRegex.exec(trimmed);
  if (!match) return null;
  const [, version, cost, salt, digest] = match;
  return {
    version,
    cost: Number(cost),
    salt,
    hash: digest,
  };
}
