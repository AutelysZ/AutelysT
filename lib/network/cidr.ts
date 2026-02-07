export type IpVersion = 4 | 6;

export interface CidrParseResult {
  version: IpVersion;
  address: bigint;
  prefix: number;
  hasPrefix: boolean;
}

export interface CidrDetails {
  version: IpVersion;
  address: string;
  prefix: number;
  network: string;
  broadcast?: string;
  netmask: string;
  wildcard?: string;
  firstUsable: string;
  lastUsable: string;
  rangeStart: string;
  rangeEnd: string;
  totalAddresses: string;
  usableAddresses: string;
}

export interface IpCheckResult {
  inRange: boolean;
  ip: string;
}

export function parseCidrInput(
  input: string,
  fallback: { ipv4: number; ipv6: number },
): { result?: CidrParseResult; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "Enter an IP address or CIDR block." };
  }

  let addressPart = trimmed;
  let prefixPart: string | null = null;
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length !== 2) {
      return {
        error: "CIDR prefix must appear once (example: 192.168.1.0/24).",
      };
    }
    addressPart = parts[0].trim();
    prefixPart = parts[1].trim();
  }

  if (!addressPart) {
    return { error: "IP address is required." };
  }

  const isIpv6 = addressPart.includes(":");
  const isIpv4 = addressPart.includes(".");

  if (!isIpv4 && !isIpv6) {
    return { error: "Invalid IP address format." };
  }

  const addressResult = isIpv6
    ? parseIpv6(addressPart)
    : parseIpv4(addressPart);
  if ("error" in addressResult) {
    return { error: addressResult.error };
  }

  const maxPrefix = isIpv6 ? 128 : 32;
  let prefix: number;
  let hasPrefix = false;

  if (prefixPart !== null) {
    if (!prefixPart) {
      return { error: "CIDR prefix is empty." };
    }
    const parsed = Number.parseInt(prefixPart, 10);
    if (!Number.isFinite(parsed)) {
      return { error: "CIDR prefix must be a number." };
    }
    if (parsed < 0 || parsed > maxPrefix) {
      return {
        error: `CIDR prefix must be between 0 and ${maxPrefix}.`,
      };
    }
    prefix = parsed;
    hasPrefix = true;
  } else {
    const fallbackPrefix = isIpv6 ? fallback.ipv6 : fallback.ipv4;
    if (fallbackPrefix < 0 || fallbackPrefix > maxPrefix) {
      return {
        error: `Default prefix must be between 0 and ${maxPrefix}.`,
      };
    }
    prefix = fallbackPrefix;
  }

  return {
    result: {
      version: isIpv6 ? 6 : 4,
      address: addressResult.value,
      prefix,
      hasPrefix,
    },
  };
}

export function getCidrDetails(parsed: CidrParseResult): CidrDetails {
  const maxBits = parsed.version === 4 ? 32 : 128;
  const hostBits = maxBits - parsed.prefix;
  const totalAddresses =
    hostBits === 0 ? BigInt(1) : BigInt(1) << BigInt(hostBits);
  const allOnes = (BigInt(1) << BigInt(maxBits)) - BigInt(1);
  const mask =
    parsed.prefix === 0 ? BigInt(0) : (allOnes << BigInt(hostBits)) & allOnes;
  const network = parsed.address & mask;
  const rangeEnd = network + totalAddresses - BigInt(1);
  const broadcast = parsed.version === 4 ? rangeEnd : undefined;
  const wildcard = parsed.version === 4 ? allOnes ^ mask : undefined;

  let firstUsable = network;
  let lastUsable = rangeEnd;
  let usableAddresses = totalAddresses;

  if (parsed.version === 4) {
    if (parsed.prefix <= 30) {
      firstUsable = network + BigInt(1);
      lastUsable = rangeEnd - BigInt(1);
      usableAddresses = totalAddresses - BigInt(2);
    }
  }

  const address = formatIpValue(parsed.version, parsed.address);
  const networkText = formatIpValue(parsed.version, network);
  const rangeEndText = formatIpValue(parsed.version, rangeEnd);
  const firstUsableText = formatIpValue(parsed.version, firstUsable);
  const lastUsableText = formatIpValue(parsed.version, lastUsable);
  const netmaskText = formatIpValue(parsed.version, mask);
  const wildcardText =
    wildcard !== undefined
      ? formatIpValue(parsed.version, wildcard)
      : undefined;
  const broadcastText =
    broadcast !== undefined
      ? formatIpValue(parsed.version, broadcast)
      : undefined;

  return {
    version: parsed.version,
    address,
    prefix: parsed.prefix,
    network: networkText,
    broadcast: broadcastText,
    netmask: netmaskText,
    wildcard: wildcardText,
    firstUsable: firstUsableText,
    lastUsable: lastUsableText,
    rangeStart: networkText,
    rangeEnd: rangeEndText,
    totalAddresses: formatBigInt(totalAddresses),
    usableAddresses: formatBigInt(usableAddresses),
  };
}

export function isIpInCidr(
  ip: string,
  cidr: CidrParseResult,
): { result?: IpCheckResult; error?: string } {
  const trimmed = ip.trim();
  if (!trimmed) {
    return { error: "Check IP is empty." };
  }
  const parsed = cidr.version === 6 ? parseIpv6(trimmed) : parseIpv4(trimmed);
  if ("error" in parsed) return { error: parsed.error };
  const maxBits = cidr.version === 4 ? 32 : 128;
  const hostBits = maxBits - cidr.prefix;
  const allOnes = (BigInt(1) << BigInt(maxBits)) - BigInt(1);
  const mask =
    cidr.prefix === 0 ? BigInt(0) : (allOnes << BigInt(hostBits)) & allOnes;
  const network = cidr.address & mask;
  const rangeEnd = network + ((BigInt(1) << BigInt(hostBits)) - BigInt(1));
  const inRange = parsed.value >= network && parsed.value <= rangeEnd;
  return {
    result: {
      inRange,
      ip: formatIpValue(cidr.version, parsed.value),
    },
  };
}

export function prefixToIpv4Netmask(prefix: number): string {
  const clamped = Math.max(0, Math.min(32, Math.floor(prefix)));
  const hostBits = 32 - clamped;
  const allOnes = (BigInt(1) << BigInt(32)) - BigInt(1);
  const mask =
    clamped === 0 ? BigInt(0) : (allOnes << BigInt(hostBits)) & allOnes;
  return formatIpv4(mask);
}

export function ipv4NetmaskToPrefix(netmask: string): {
  prefix?: number;
  error?: string;
} {
  const parsed = parseIpv4(netmask.trim());
  if ("error" in parsed) return { error: parsed.error };
  const value = Number(parsed.value);
  if (!Number.isFinite(value) || value < 0) {
    return { error: "Netmask is invalid." };
  }
  let seenZero = false;
  let prefix = 0;
  for (let i = 31; i >= 0; i -= 1) {
    const bit = (value >> i) & 1;
    if (bit === 1) {
      if (seenZero) {
        return { error: "Netmask bits must be contiguous." };
      }
      prefix += 1;
    } else {
      seenZero = true;
    }
  }
  return { prefix };
}

export function formatBigInt(value: bigint): string {
  const raw = value.toString(10);
  const sign = raw.startsWith("-") ? "-" : "";
  const digits = sign ? raw.slice(1) : raw;
  const parts: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    const start = Math.max(i - 3, 0);
    parts.unshift(digits.slice(start, i));
  }
  return sign + parts.join(",");
}

export function formatIpValue(version: IpVersion, value: bigint): string {
  return version === 4 ? formatIpv4(value) : formatIpv6(value);
}

function parseIpv4(address: string): { value: bigint } | { error: string } {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return { error: "IPv4 address must have 4 octets." };
  }

  let value = BigInt(0);
  for (const part of parts) {
    if (!part) {
      return { error: "IPv4 address contains an empty octet." };
    }
    if (!/^\d+$/.test(part)) {
      return { error: "IPv4 address contains non-numeric octets." };
    }
    const octet = Number.parseInt(part, 10);
    if (!Number.isFinite(octet) || octet < 0 || octet > 255) {
      return { error: "IPv4 octet must be between 0 and 255." };
    }
    value = (value << BigInt(8)) + BigInt(octet);
  }

  return { value };
}

function parseIpv6(address: string): { value: bigint } | { error: string } {
  let normalized = address.trim();
  if (!normalized) {
    return { error: "IPv6 address is empty." };
  }

  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex >= 0) {
    normalized = normalized.slice(0, zoneIndex);
  }

  const firstDouble = normalized.indexOf("::");
  if (firstDouble !== -1 && normalized.indexOf("::", firstDouble + 2) !== -1) {
    return { error: "IPv6 address can only contain one '::'." };
  }

  const hasDouble = firstDouble !== -1;
  const [leftRaw, rightRaw] = hasDouble
    ? normalized.split("::")
    : [normalized, ""];

  let leftParts = leftRaw ? leftRaw.split(":") : [];
  let rightParts = rightRaw ? rightRaw.split(":") : [];

  const convertIpv4Part = (part: string) => {
    const ipv4 = parseIpv4(part);
    if ("error" in ipv4) {
      return { error: ipv4.error };
    }
    const high = Number((ipv4.value >> BigInt(16)) & BigInt(0xffff));
    const low = Number(ipv4.value & BigInt(0xffff));
    return { parts: [high.toString(16), low.toString(16)] };
  };

  if (
    rightParts.length > 0 &&
    rightParts[rightParts.length - 1].includes(".")
  ) {
    const ipv4Result = convertIpv4Part(rightParts[rightParts.length - 1]);
    if ("error" in ipv4Result) return { error: ipv4Result.error };
    rightParts = [...rightParts.slice(0, -1), ...ipv4Result.parts];
  } else if (
    rightParts.length === 0 &&
    leftParts.length > 0 &&
    leftParts[leftParts.length - 1].includes(".")
  ) {
    const ipv4Result = convertIpv4Part(leftParts[leftParts.length - 1]);
    if ("error" in ipv4Result) return { error: ipv4Result.error };
    leftParts = [...leftParts.slice(0, -1), ...ipv4Result.parts];
  }

  const totalParts = leftParts.length + rightParts.length;
  if (!hasDouble && totalParts !== 8) {
    return { error: "IPv6 address must have 8 hextets." };
  }
  if (hasDouble && totalParts > 8) {
    return { error: "IPv6 address has too many hextets." };
  }

  const zerosToInsert = hasDouble ? 8 - totalParts : 0;
  const parts = [
    ...leftParts,
    ...Array.from({ length: zerosToInsert }, () => "0"),
    ...rightParts,
  ];

  if (parts.length !== 8) {
    return { error: "IPv6 address is invalid after expansion." };
  }

  let value = BigInt(0);
  for (const part of parts) {
    if (!part) {
      return { error: "IPv6 address contains an empty hextet." };
    }
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
      return { error: "IPv6 hextet must be 1-4 hex digits." };
    }
    const hextet = Number.parseInt(part, 16);
    value = (value << BigInt(16)) + BigInt(hextet);
  }

  return { value };
}

function formatIpv4(value: bigint): string {
  const parts: string[] = [];
  for (let i = 3; i >= 0; i -= 1) {
    const octet = Number((value >> BigInt(i * 8)) & BigInt(0xff));
    parts.push(octet.toString(10));
  }
  return parts.join(".");
}

function formatIpv6(value: bigint): string {
  const hextets: number[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const hextet = Number((value >> BigInt(i * 16)) & BigInt(0xffff));
    hextets.push(hextet);
  }

  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  let currentLength = 0;

  for (let i = 0; i <= hextets.length; i += 1) {
    if (i < hextets.length && hextets[i] === 0) {
      if (currentStart === -1) currentStart = i;
      currentLength += 1;
    } else {
      if (currentLength >= 2 && currentLength > bestLength) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
      currentStart = -1;
      currentLength = 0;
    }
  }

  const parts: string[] = [];
  for (let i = 0; i < hextets.length; i += 1) {
    if (bestLength >= 2 && i === bestStart) {
      parts.push("");
      i += bestLength - 1;
      if (i === hextets.length - 1) {
        parts.push("");
      }
      continue;
    }
    parts.push(hextets[i].toString(16));
  }

  const result = parts.join(":");
  if (result.startsWith(":")) return `:${result}`;
  if (result.endsWith(":")) return `${result}:`;
  return result;
}
