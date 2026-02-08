export interface ParsedLogEntry {
  raw: string;
  timestamp?: string;
  level?: string;
  status?: number;
  method?: string;
  path?: string;
  ip?: string;
}

export interface LogAnalysisSummary {
  totalLines: number;
  parsedLines: number;
  unparsedLines: number;
  levelCounts: Record<string, number>;
  statusBuckets: Record<string, number>;
  topPaths: Array<{ path: string; count: number }>;
  topIps: Array<{ ip: string; count: number }>;
  recentErrors: ParsedLogEntry[];
}

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

function normalizeLevel(input?: string): string | undefined {
  if (!input) return undefined;
  const upper = input.toUpperCase();
  if (upper === "WARNING") return "WARN";
  if (upper === "ERR") return "ERROR";
  return upper;
}

function parseCommonAccessLog(line: string): ParsedLogEntry | null {
  const match = line.match(
    /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+)\s([^"]*?)\s[^"]*" (\d{3}) (\S+)/,
  );
  if (!match) return null;
  return {
    raw: line,
    ip: match[1],
    timestamp: match[2],
    method: match[3],
    path: match[4],
    status: Number(match[5]),
  };
}

function parseJsonLog(line: string): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const level = normalizeLevel(
      String(parsed.level ?? parsed.severity ?? parsed.lvl ?? ""),
    );
    const statusRaw = parsed.status ?? parsed.statusCode;
    const status =
      typeof statusRaw === "number"
        ? statusRaw
        : typeof statusRaw === "string" && /^\d+$/.test(statusRaw)
          ? Number(statusRaw)
          : undefined;
    const methodRaw = parsed.method;
    const method =
      typeof methodRaw === "string" ? methodRaw.toUpperCase() : undefined;
    const pathRaw = parsed.path ?? parsed.url ?? parsed.requestPath;
    const path = typeof pathRaw === "string" ? pathRaw : undefined;
    const timestampRaw = parsed.time ?? parsed.timestamp ?? parsed.ts;
    const timestamp =
      typeof timestampRaw === "string" ? timestampRaw : undefined;
    const ipRaw = parsed.ip ?? parsed.remoteAddr;
    const ip = typeof ipRaw === "string" ? ipRaw : undefined;

    return {
      raw: line,
      level,
      status,
      method,
      path,
      timestamp,
      ip,
    };
  } catch (error) {
    // Invalid JSON line should not fail whole analysis.
    console.error(error);
    return null;
  }
}

function parseFreeformLog(line: string): ParsedLogEntry | null {
  const levelMatch = line.match(
    /\b(ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b/i,
  );
  const methodMatch = line.match(
    /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i,
  );
  const statusMatch = line.match(/\b([1-5]\d{2})\b/);
  const pathMatch = line.match(/\s(\/[^\s"]*)/);
  const ipMatch = line.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);

  if (!levelMatch && !methodMatch && !statusMatch && !pathMatch) {
    return null;
  }

  return {
    raw: line,
    level: normalizeLevel(levelMatch?.[1]),
    method: methodMatch?.[1]?.toUpperCase(),
    status: statusMatch ? Number(statusMatch[1]) : undefined,
    path: pathMatch?.[1],
    ip: ipMatch?.[0],
  };
}

export function parseLogLine(line: string): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const asJson = parseJsonLog(trimmed);
  if (asJson) return asJson;

  const asCommon = parseCommonAccessLog(trimmed);
  if (asCommon) return asCommon;

  return parseFreeformLog(trimmed);
}

function getStatusBucket(status?: number): string | undefined {
  if (!status || !Number.isFinite(status)) return undefined;
  if (status >= 100 && status < 200) return "1xx";
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

export function analyzeLogs(input: string): {
  summary: LogAnalysisSummary;
  entries: ParsedLogEntry[];
} {
  const lines = input.split(/\r?\n/g);
  const parsed: ParsedLogEntry[] = [];
  let unparsedLines = 0;

  const levelCounts: Record<string, number> = {};
  const statusBuckets: Record<string, number> = {
    "1xx": 0,
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
    other: 0,
  };
  const pathCounts: Record<string, number> = {};
  const ipCounts: Record<string, number> = {};

  for (const line of lines) {
    const entry = parseLogLine(line);
    if (!entry) {
      if (line.trim()) {
        unparsedLines += 1;
      }
      continue;
    }
    parsed.push(entry);

    if (entry.level) {
      levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
    }

    const bucket = getStatusBucket(entry.status);
    if (bucket) {
      statusBuckets[bucket] += 1;
    }

    if (entry.path) {
      pathCounts[entry.path] = (pathCounts[entry.path] || 0) + 1;
    }

    if (entry.ip) {
      ipCounts[entry.ip] = (ipCounts[entry.ip] || 0) + 1;
    }
  }

  const topPaths = Object.entries(pathCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topIps = Object.entries(ipCounts)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentErrors = parsed
    .filter((entry) => entry.level === "ERROR" || (entry.status ?? 0) >= 500)
    .slice(-10)
    .reverse();

  return {
    summary: {
      totalLines: lines.filter((line) => line.trim()).length,
      parsedLines: parsed.length,
      unparsedLines,
      levelCounts,
      statusBuckets,
      topPaths,
      topIps,
      recentErrors,
    },
    entries: parsed,
  };
}

export function isLikelyAccessLog(entry: ParsedLogEntry): boolean {
  return Boolean(
    entry.method &&
    HTTP_METHODS.includes(entry.method.toUpperCase()) &&
    entry.path &&
    entry.status,
  );
}
