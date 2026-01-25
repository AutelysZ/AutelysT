import Url from "url-parse";
import iconv from "iconv-lite";
import { decode, encode } from "urlencode";
import type { ParsedUrlData, UrlParam } from "./url-builder-types";

const ICONV_ENCODING_KEYS = (() => {
  try {
    iconv.getCodec("utf8");
    const encodings = iconv.encodings ?? {};
    return Object.keys(encodings);
  } catch (error) {
    console.error("URL Builder encoding load failed", error);
    return [];
  }
})();

const SORTED_ENCODINGS = ICONV_ENCODING_KEYS.filter(
  (key) => key !== "utf8",
).sort((a, b) => a.localeCompare(b));

export const URL_ENCODING_OPTIONS = [
  { value: "utf8", label: "UTF-8" },
  ...SORTED_ENCODINGS.map((encoding) => ({
    value: encoding,
    label: encoding.toUpperCase(),
  })),
];

export function normalizeEncoding(encoding: string): string {
  if (!encoding) return "utf8";
  try {
    const normalized = iconv._canonicalizeEncoding(encoding as never);
    return iconv.encodingExists(normalized) ? normalized : "utf8";
  } catch (error) {
    console.error("URL Builder encoding normalize failed", error);
    return "utf8";
  }
}

const EMPTY_PARSED: ParsedUrlData = {
  protocol: "",
  username: "",
  password: "",
  hostname: "",
  port: "",
  pathname: "",
  queryParams: [],
  hashPathname: "",
  hashParams: [],
};

const PATH_ALLOWED_CHARS = /[A-Za-z0-9\-._~!$&'()*+,;=:@\/]/;

function decodePath(raw: string, encoding: string): string {
  if (!raw) return "";
  const placeholders: string[] = [];
  const masked = raw.replace(/%2f/gi, (match) => {
    const token = `__URL_SLASH_PLACEHOLDER_${placeholders.length}__`;
    placeholders.push(match);
    return token;
  });
  const decoded = safeDecode(masked, encoding);
  return decoded.replace(/__URL_SLASH_PLACEHOLDER_(\d+)__/g, (match, index) => {
    const value = placeholders[Number(index)];
    return value ?? match;
  });
}

function encodePath(value: string, encoding: string): string {
  if (!value) return "";
  let result = "";
  let index = 0;

  while (index < value.length) {
    const current = value[index];
    if (current === "%" && index + 2 < value.length) {
      const hex = value.slice(index + 1, index + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        result += value.slice(index, index + 3);
        index += 3;
        continue;
      }
    }

    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    const charLength = char.length;

    if (charLength === 1 && PATH_ALLOWED_CHARS.test(char)) {
      result += char;
    } else {
      result += safeEncode(char, encoding);
    }

    index += charLength;
  }

  return result;
}

function safeDecode(value: string, encoding: string): string {
  try {
    return decode(value, encoding);
  } catch (error) {
    console.error("URL Builder decode failed", error);
    return value;
  }
}

function safeEncode(value: string, encoding: string): string {
  try {
    return encode(value, encoding);
  } catch (error) {
    console.error("URL Builder encode failed", error);
    return value;
  }
}

function decodeQueryComponent(value: string, encoding: string): string {
  return safeDecode(value.replace(/\+/g, " "), encoding);
}

function parseParams(raw: string, encoding: string): UrlParam[] {
  if (!raw) return [];
  return raw.split("&").map((segment) => {
    if (!segment) return { key: "", value: "" };
    const index = segment.indexOf("=");
    const keyRaw = index >= 0 ? segment.slice(0, index) : segment;
    const valueRaw = index >= 0 ? segment.slice(index + 1) : "";
    return {
      key: decodeQueryComponent(keyRaw, encoding),
      value: decodeQueryComponent(valueRaw, encoding),
    };
  });
}

function buildParams(params: UrlParam[], encoding: string): string {
  if (!params.length) return "";
  const parts = params.map(({ key, value }) => {
    const hasKey = key.length > 0;
    const hasValue = value.length > 0;
    if (!hasKey && !hasValue) return "";
    if (!hasKey) return `=${safeEncode(value, encoding)}`;
    const encodedKey = safeEncode(key, encoding);
    if (!hasValue) return `${encodedKey}=`;
    return `${encodedKey}=${safeEncode(value, encoding)}`;
  });
  return parts.join("&");
}

export function buildEncodedQuery(
  params: UrlParam[],
  encoding: string,
): string {
  const queryString = buildParams(params, encoding);
  return queryString ? `?${queryString}` : "";
}

export function buildEncodedHash(
  hashPathname: string,
  params: UrlParam[],
  encoding: string,
): string {
  const hashPath = encodePath(hashPathname.trim(), encoding);
  const hashQuery = buildParams(params, encoding);
  if (!hashPath && !hashQuery) return "";
  return `#${hashPath}${hashQuery ? `?${hashQuery}` : ""}`;
}

function splitHash(hash: string): { path: string; query: string } {
  if (!hash) return { path: "", query: "" };
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { path: "", query: "" };
  const index = raw.indexOf("?");
  if (index === -1) return { path: raw, query: "" };
  return { path: raw.slice(0, index), query: raw.slice(index + 1) };
}

export function parseUrl(input: string, encoding: string): ParsedUrlData {
  if (!input) return { ...EMPTY_PARSED };
  try {
    const parsed = new Url(input, {});
    const queryRaw =
      typeof parsed.query === "string" ? parsed.query.replace(/^\?/, "") : "";
    const hashParts = splitHash(parsed.hash);
    return {
      protocol: parsed.protocol.replace(/:$/, ""),
      username: parsed.username || "",
      password: parsed.password || "",
      hostname: parsed.hostname || "",
      port: parsed.port || "",
      pathname: decodePath(parsed.pathname || "", encoding),
      queryParams: parseParams(queryRaw, encoding),
      hashPathname: decodePath(hashParts.path, encoding),
      hashParams: parseParams(hashParts.query, encoding),
    };
  } catch (error) {
    console.error("URL Builder parse failed", error);
    return { ...EMPTY_PARSED };
  }
}

export function buildUrl(data: ParsedUrlData, encoding: string): string {
  const url = new Url("", {});
  const protocol = data.protocol.trim();
  const hostname = data.hostname.trim();
  const port = data.port.trim();
  const username = data.username.trim();
  const password = data.password.trim();

  url.set("protocol", protocol || "");

  if (hostname) {
    url.set("hostname", hostname);
  } else {
    url.set("hostname", "");
  }

  if (port && hostname) {
    url.set("port", port);
  } else {
    url.set("port", "");
  }

  url.set("username", username);
  url.set("password", password);

  const hasAuthority = Boolean(
    protocol || hostname || port || username || password,
  );
  const pathname = encodePath(data.pathname.trim(), encoding);
  if (pathname) {
    if (hasAuthority && !pathname.startsWith("/")) {
      url.set("pathname", `/${pathname}`);
    } else {
      url.set("pathname", pathname);
    }
  } else {
    url.set("pathname", "");
  }

  const queryString = buildParams(data.queryParams, encoding);
  url.set("query", queryString ? `?${queryString}` : "", (value) => value);

  const hashPath = encodePath(data.hashPathname.trim(), encoding);
  const hashQuery = buildParams(data.hashParams, encoding);
  const hashValue =
    hashPath || hashQuery
      ? `${hashPath}${hashQuery ? `?${hashQuery}` : ""}`
      : "";
  url.set("hash", hashValue ? `#${hashValue}` : "");

  return url.toString();
}
