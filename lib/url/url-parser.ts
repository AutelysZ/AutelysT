export interface ParsedURL {
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  host: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  searchParams: Array<{ key: string; value: string }>;
  hashParams: Array<{ key: string; value: string }>;
}

export function parseURL(urlString: string): ParsedURL | null {
  try {
    const url = new URL(urlString);

    // Parse search params
    const searchParams: Array<{ key: string; value: string }> = [];
    url.searchParams.forEach((value, key) => {
      searchParams.push({ key, value });
    });

    // Parse hash params (if hash contains query string format)
    const hashParams: Array<{ key: string; value: string }> = [];
    if (url.hash) {
      const hashQuery = url.hash.includes("?")
        ? url.hash.split("?")[1]
        : url.hash.slice(1);
      if (hashQuery) {
        try {
          const params = new URLSearchParams(hashQuery);
          params.forEach((value, key) => {
            hashParams.push({ key, value });
          });
        } catch {
          // Hash is not query format, skip parsing
        }
      }
    }

    return {
      protocol: url.protocol,
      username: url.username,
      password: url.password,
      hostname: url.hostname,
      port: url.port,
      host: url.host,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      searchParams,
      hashParams,
    };
  } catch {
    return null;
  }
}

export function encodeURL(text: string): string {
  try {
    return encodeURIComponent(text);
  } catch {
    return text;
  }
}

export function decodeURL(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
