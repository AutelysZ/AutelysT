import {
  encodeBase64NoPadding,
  randomBytes,
  toPositiveInt,
  utf8ToBytes,
} from "./utils";

export type Argon2Variant = "argon2d" | "argon2i" | "argon2id";

export type Argon2Params = {
  type: Argon2Variant;
  time: number;
  memory: number;
  parallelism: number;
  hashLen: number;
  salt: string;
  saltLength: number;
};

export type Argon2Parsed = {
  type: Argon2Variant;
  version?: string;
  memory?: number;
  time?: number;
  parallelism?: number;
  salt?: string;
  hash?: string;
};

const ARGON2_SCRIPT_URL =
  "https://unpkg.com/argon2-browser@1.18.0/dist/argon2-bundled.min.js";

let argon2Promise: Promise<Argon2Module> | null = null;

export type Argon2Module = {
  ArgonType: {
    Argon2d: number;
    Argon2i: number;
    Argon2id: number;
  };
  hash: (params: Record<string, unknown>) => Promise<{ encoded: string }>;
  verify: (params: Record<string, unknown>) => Promise<void>;
};

declare global {
  interface Window {
    argon2?: Argon2Module;
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is not available"));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-argon2=\"${id}\"]`,
    );
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Argon2 bundle")),
          { once: true },
        );
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.argon2 = id;
    script.addEventListener("load", () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    });
    script.addEventListener("error", () => {
      reject(new Error("Failed to load Argon2 bundle"));
    });
    document.head.appendChild(script);
  });
}

async function getArgon2(): Promise<Argon2Module> {
  if (typeof window === "undefined") {
    throw new Error("Argon2 is only available in the browser");
  }
  if (window.argon2) return window.argon2;
  if (!argon2Promise) {
    argon2Promise = loadScript(ARGON2_SCRIPT_URL, "argon2")
      .then(() => {
        if (!window.argon2) {
          throw new Error("Argon2 bundle did not expose the module");
        }
        return window.argon2;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  }
  return argon2Promise;
}

export async function hashArgon2(
  password: string,
  params: Argon2Params,
): Promise<string> {
  const argon2 = await getArgon2();
  const salt = params.salt.trim()
    ? utf8ToBytes(params.salt)
    : randomBytes(toPositiveInt(params.saltLength, 16));

  const result = await argon2.hash({
    pass: password,
    salt,
    time: toPositiveInt(params.time, 3),
    mem: toPositiveInt(params.memory, 65536),
    parallelism: toPositiveInt(params.parallelism, 1),
    hashLen: toPositiveInt(params.hashLen, 32),
    type: argon2.ArgonType[getArgonTypeKey(params.type)],
  });
  return result.encoded;
}

export async function verifyArgon2(
  password: string,
  encoded: string,
): Promise<boolean> {
  const argon2 = await getArgon2();
  try {
    await argon2.verify({ pass: password, encoded });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

const phc = require("@phc/format");

export function parseArgon2Hash(hash: string): Argon2Parsed | null {
  try {
    const parsed = phc.deserialize(hash);
    if (!["argon2id", "argon2i", "argon2d"].includes(parsed.id)) return null;
    const { m, t, p } = parsed.params;
    return {
      type: parsed.id as Argon2Variant,
      version: parsed.version,
      memory: Number(m),
      time: Number(t),
      parallelism: Number(p),
      salt: encodeBase64NoPadding(parsed.salt),
      hash: encodeBase64NoPadding(parsed.hash),
    };
  } catch {
    return null;
  }
}

function getArgonTypeKey(
  value: Argon2Variant,
): keyof Argon2Module["ArgonType"] {
  switch (value) {
    case "argon2i":
      return "Argon2i";
    case "argon2id":
      return "Argon2id";
    case "argon2d":
    default:
      return "Argon2d";
  }
}
