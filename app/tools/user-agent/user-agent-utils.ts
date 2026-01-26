import { UAParser } from "ua-parser-js";
import type { UserAgentJson } from "./user-agent-types";

const emptyUserAgent: UserAgentJson = {
  ua: "",
  browser: { name: "", version: "", major: "" },
  engine: { name: "", version: "" },
  os: { name: "", version: "" },
  device: { vendor: "", model: "", type: "" },
  cpu: { architecture: "" },
};

export function getEmptyUserAgent(): UserAgentJson {
  return JSON.parse(JSON.stringify(emptyUserAgent)) as UserAgentJson;
}

export function formatUserAgentJson(data: UserAgentJson): string {
  return JSON.stringify(stripEmptyValues(data), null, 2);
}

export function parseUserAgentJson(value: string):
  | { data: UserAgentJson; error: null }
  | { data: UserAgentJson; error: string } {
  if (!value.trim()) {
    return { data: getEmptyUserAgent(), error: null };
  }
  try {
    const parsed = JSON.parse(value) as UserAgentJson;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        data: getEmptyUserAgent(),
        error: "JSON must be an object.",
      };
    }
    return { data: normalizeUserAgentJson(parsed), error: null };
  } catch (error) {
    console.error(error);
    return {
      data: getEmptyUserAgent(),
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export function parseUserAgentString(value: string):
  | { json: string; error: null }
  | { json: string; error: string } {
  const cleaned = normalizeUserAgentHeader(value);
  if (!cleaned) {
    return { json: "", error: "User-Agent string is empty." };
  }
  try {
    const parser = new UAParser(cleaned);
    const result = parser.getResult();
    const json: UserAgentJson = {
      ua: cleaned,
      browser: {
        name: result.browser?.name,
        version: result.browser?.version,
        major: result.browser?.major,
      },
      engine: {
        name: result.engine?.name,
        version: result.engine?.version,
      },
      os: {
        name: result.os?.name,
        version: result.os?.version,
      },
      device: {
        vendor: result.device?.vendor,
        model: result.device?.model,
        type: result.device?.type,
      },
      cpu: {
        architecture: result.cpu?.architecture,
      },
    };
    return { json: formatUserAgentJson(json), error: null };
  } catch (error) {
    console.error(error);
    return {
      json: "",
      error: error instanceof Error ? error.message : "Failed to parse UA.",
    };
  }
}

export function buildUserAgentString(value: string):
  | { ua: string; error: null }
  | { ua: string; error: string } {
  const parsed = parseUserAgentJson(value);
  if (parsed.error) {
    return { ua: "", error: parsed.error };
  }
  const ua = buildUaFromJson(parsed.data);
  if (!ua) {
    return { ua: "", error: "User-Agent data is empty." };
  }
  return { ua, error: null };
}

function normalizeUserAgentHeader(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^user-agent\s*:\s*/i, "").trim();
}

function normalizeUserAgentJson(value: UserAgentJson): UserAgentJson {
  return {
    ua: value.ua ?? "",
    browser: {
      name: value.browser?.name ?? "",
      version: value.browser?.version ?? "",
      major: value.browser?.major ?? "",
    },
    engine: {
      name: value.engine?.name ?? "",
      version: value.engine?.version ?? "",
    },
    os: {
      name: value.os?.name ?? "",
      version: value.os?.version ?? "",
    },
    device: {
      vendor: value.device?.vendor ?? "",
      model: value.device?.model ?? "",
      type: value.device?.type ?? "",
    },
    cpu: {
      architecture: value.cpu?.architecture ?? "",
    },
  };
}

function stripEmptyValues(value: UserAgentJson): UserAgentJson {
  const next: UserAgentJson = {};

  if (value.ua) next.ua = value.ua;

  const browser = stripEmptyObject(value.browser);
  if (browser) next.browser = browser as UserAgentJson["browser"];

  const engine = stripEmptyObject(value.engine);
  if (engine) next.engine = engine as UserAgentJson["engine"];

  const os = stripEmptyObject(value.os);
  if (os) next.os = os as UserAgentJson["os"];

  const device = stripEmptyObject(value.device);
  if (device) next.device = device as UserAgentJson["device"];

  const cpu = stripEmptyObject(value.cpu);
  if (cpu) next.cpu = cpu as UserAgentJson["cpu"];

  return next;
}

function stripEmptyObject<T extends Record<string, unknown>>(
  value: T | undefined,
): T | null {
  if (!value) return null;
  const entries = Object.entries(value).filter(([, v]) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && !v.trim()) return false;
    return true;
  });
  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as T;
}

function buildUaFromJson(value: UserAgentJson): string {
  const hasParts = hasAgentParts(value);
  if (!hasParts && value.ua?.trim()) return value.ua.trim();
  if (!hasParts) return "";

  const systemTokens = [
    formatOs(value.os),
    formatDevice(value.device),
    value.cpu?.architecture?.trim() || "",
  ].filter(Boolean);

  let ua = "Mozilla/5.0";

  if (systemTokens.length > 0) {
    ua += ` (${systemTokens.join("; ")})`;
  }

  const engine = formatProduct(value.engine);
  const browser = formatProduct(value.browser);

  if (engine) ua += ` ${engine}`;
  if (browser) ua += ` ${browser}`;

  return ua.trim();
}

function hasAgentParts(value: UserAgentJson): boolean {
  return Boolean(
    value.browser?.name ||
      value.browser?.version ||
      value.engine?.name ||
      value.engine?.version ||
      value.os?.name ||
      value.os?.version ||
      value.device?.vendor ||
      value.device?.model ||
      value.device?.type ||
      value.cpu?.architecture,
  );
}

function formatProduct(value?: { name?: string; version?: string }): string {
  const name = value?.name?.trim();
  const version = value?.version?.trim();
  if (!name && !version) return "";
  if (!name) return version || "";
  if (!version) return name;
  return `${name}/${version}`;
}

function formatOs(value?: { name?: string; version?: string }): string {
  const name = value?.name?.trim();
  const version = value?.version?.trim();
  if (!name && !version) return "";
  if (!name) return version || "";
  if (!version) return name;
  return `${name} ${version}`;
}

function formatDevice(value?: {
  vendor?: string;
  model?: string;
  type?: string;
}): string {
  const vendor = value?.vendor?.trim() || "";
  const model = value?.model?.trim() || "";
  const type = value?.type?.trim() || "";
  const parts = [vendor, model, type].filter(Boolean);
  return parts.join(" ");
}
