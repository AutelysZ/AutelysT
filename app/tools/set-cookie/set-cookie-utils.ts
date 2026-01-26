import { parseSetCookie, stringifySetCookie } from "cookie";
import { splitCookiesString } from "set-cookie-parser";
import type { CookieJson } from "./set-cookie-types";

const HEADER_PREFIX = "set-cookie:";

function normalizeHeaderLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith(HEADER_PREFIX)) {
    return trimmed.slice(HEADER_PREFIX.length).trim();
  }
  return trimmed;
}

function normalizeSameSite(value: unknown): CookieJson["sameSite"] | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "lax" || lower === "strict" || lower === "none") {
      return lower as CookieJson["sameSite"];
    }
  }
  return undefined;
}

export function parseSetCookieHeader(text: string): {
  json: string;
  error: string | null;
} {
  try {
    const lines = text
      .split(/\r?\n/)
      .map(normalizeHeaderLine)
      .filter(Boolean);

    const cookies: CookieJson[] = [];
    for (const line of lines) {
      const parts = splitCookiesString(line);
      for (const part of parts) {
        const parsed = parseSetCookie(part.trim());
        if (!parsed?.name) continue;
        const expires =
          parsed.expires instanceof Date &&
          !Number.isNaN(parsed.expires.getTime())
            ? parsed.expires.toISOString()
            : undefined;
        const knownKeys = new Set([
          "name",
          "value",
          "domain",
          "path",
          "expires",
          "maxAge",
          "httpOnly",
          "secure",
          "sameSite",
          "partitioned",
          "priority",
        ]);
        const extensions: string[] = [];
        Object.entries(parsed).forEach(([key, value]) => {
          if (knownKeys.has(key)) return;
          if (value === undefined || value === null) return;
          if (typeof value === "boolean") {
            if (value) extensions.push(key);
            return;
          }
          extensions.push(`${key}=${value}`);
        });

        cookies.push({
          name: parsed.name,
          value: parsed.value,
          domain: parsed.domain,
          path: parsed.path,
          expires,
          maxAge: parsed.maxAge,
          httpOnly: parsed.httpOnly,
          secure: parsed.secure,
          sameSite: normalizeSameSite(parsed.sameSite),
          priority: parsed.priority,
          partitioned: parsed.partitioned,
          extensions: extensions.length ? extensions : undefined,
        });
      }
    }

    return {
      json: JSON.stringify(cookies, null, 2),
      error: null,
    };
  } catch (error) {
    return {
      json: "",
      error: error instanceof Error ? error.message : "Failed to parse header.",
    };
  }
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

function coerceCookies(input: unknown): CookieJson[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as CookieJson[];
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.cookies)) return obj.cookies as CookieJson[];
    if (typeof obj.name === "string") return [obj as CookieJson];
  }
  return [];
}

export function parseCookieJson(text: string): {
  cookies: CookieJson[];
  error: string | null;
} {
  if (!text.trim()) {
    return { cookies: [], error: null };
  }
  try {
    const parsed = JSON.parse(text);
    const cookies = coerceCookies(parsed);
    const hasArray =
      Array.isArray(parsed) ||
      (typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { cookies?: unknown }).cookies));
    if (!cookies.length && !hasArray) {
      return { cookies: [], error: "No cookies found in JSON." };
    }
    return { cookies, error: null };
  } catch (error) {
    return {
      cookies: [],
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}

export function formatCookieJson(cookies: CookieJson[]): string {
  return JSON.stringify(cookies, null, 2);
}

export function buildSetCookieHeader(text: string): {
  header: string;
  error: string | null;
} {
  try {
    if (!text.trim()) {
      return { header: "", error: null };
    }
    const parsed = JSON.parse(text);
    const cookies = coerceCookies(parsed);
    if (!cookies.length) {
      return {
        header: "",
        error: "No cookies found in JSON.",
      };
    }

    const lines: string[] = [];
    for (const cookie of cookies) {
      if (!cookie?.name) {
        return { header: "", error: "Each cookie needs a name." };
      }
      const options = {
        domain: cookie.domain || undefined,
        path: cookie.path || undefined,
        expires: toDate(cookie.expires),
        maxAge:
          typeof cookie.maxAge === "number" ? cookie.maxAge : undefined,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        priority: cookie.priority,
        partitioned: cookie.partitioned,
      };
      const serialized = stringifySetCookie({
        name: cookie.name,
        value: cookie.value ?? "",
        ...options,
      });

      const extensions = Array.isArray(cookie.extensions)
        ? cookie.extensions.filter(Boolean)
        : [];
      const withExtensions =
        extensions.length > 0
          ? `${serialized}; ${extensions.join("; ")}`
          : serialized;

      lines.push(`Set-Cookie: ${withExtensions}`);
    }

    return { header: lines.join("\n"), error: null };
  } catch (error) {
    return {
      header: "",
      error:
        error instanceof Error ? error.message : "Failed to build header.",
    };
  }
}
