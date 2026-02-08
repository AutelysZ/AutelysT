export interface HarRequestSummary {
  method: string;
  url: string;
  status: number;
  timeMs: number;
  transferBytes: number;
}

export interface HarAnalysisSummary {
  totalEntries: number;
  totalTransferBytes: number;
  totalTimeMs: number;
  methods: Record<string, number>;
  statusBuckets: Record<string, number>;
  topHosts: Array<{ host: string; count: number }>;
  slowestRequests: HarRequestSummary[];
}

type HarEntry = {
  time?: number;
  request?: {
    method?: string;
    url?: string;
  };
  response?: {
    status?: number;
    bodySize?: number;
    _transferSize?: number;
    headersSize?: number;
    content?: {
      size?: number;
    };
  };
};

function safeSize(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (typeof value === "number" && value >= 0) {
      return value;
    }
  }
  return 0;
}

function getStatusBucket(status: number): string {
  if (status >= 100 && status < 200) return "1xx";
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

export function parseHarJson(input: string): {
  har: unknown | null;
  error?: string;
} {
  if (!input.trim()) {
    return { har: null, error: "HAR JSON input is required." };
  }

  try {
    const parsed = JSON.parse(input);
    return { har: parsed };
  } catch (error) {
    console.error(error);
    return {
      har: null,
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}

export function analyzeHar(har: unknown): HarAnalysisSummary {
  const entries = (
    (har as { log?: { entries?: HarEntry[] } })?.log?.entries || []
  ).filter(Boolean);

  const methods: Record<string, number> = {};
  const statusBuckets: Record<string, number> = {
    "1xx": 0,
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
    other: 0,
  };
  const hosts: Record<string, number> = {};
  const requestRows: HarRequestSummary[] = [];

  let totalTransferBytes = 0;
  let totalTimeMs = 0;

  for (const entry of entries) {
    const method = (entry.request?.method || "UNKNOWN").toUpperCase();
    const rawUrl = entry.request?.url || "";
    const status = Number.isFinite(entry.response?.status)
      ? Number(entry.response?.status)
      : 0;
    const timeMs = Number.isFinite(entry.time) ? Number(entry.time) : 0;
    const transferBytes = safeSize(
      entry.response?._transferSize,
      entry.response?.bodySize,
      entry.response?.content?.size,
    );

    methods[method] = (methods[method] || 0) + 1;
    statusBuckets[getStatusBucket(status)] += 1;
    totalTransferBytes += transferBytes;
    totalTimeMs += timeMs;

    try {
      const host = new URL(rawUrl).host || "(unknown)";
      hosts[host] = (hosts[host] || 0) + 1;
    } catch (error) {
      console.error(error);
      hosts["(invalid url)"] = (hosts["(invalid url)"] || 0) + 1;
    }

    requestRows.push({
      method,
      url: rawUrl,
      status,
      timeMs,
      transferBytes,
    });
  }

  const topHosts = Object.entries(hosts)
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const slowestRequests = requestRows
    .slice()
    .sort((a, b) => b.timeMs - a.timeMs)
    .slice(0, 10);

  return {
    totalEntries: entries.length,
    totalTransferBytes,
    totalTimeMs,
    methods,
    statusBuckets,
    topHosts,
    slowestRequests,
  };
}
