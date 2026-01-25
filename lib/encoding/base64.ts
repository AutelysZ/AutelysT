// Base64 encoding/decoding utilities using built-in btoa/atob

export interface Base64Options {
  padding?: boolean;
  urlSafe?: boolean;
  mimeFormat?: boolean;
}

export interface DetectedBase64Options {
  hasPadding: boolean;
  isUrlSafe: boolean;
  hasMimeLineBreaks: boolean;
}

// Detect base64 variant from input
export function detectBase64Options(input: string): DetectedBase64Options {
  const cleanInput = input.replace(/[\r\n\s]/g, "");

  return {
    hasPadding: cleanInput.includes("="),
    isUrlSafe: cleanInput.includes("-") || cleanInput.includes("_"),
    hasMimeLineBreaks: input.includes("\n") || input.includes("\r"),
  };
}

export function encodeBase64(
  bytes: Uint8Array,
  options: Base64Options = {},
): string {
  const { padding = true, urlSafe = false, mimeFormat = false } = options;

  // Convert Uint8Array to binary string
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Use built-in btoa
  let result = btoa(binary);

  // Handle URL-safe variant
  if (urlSafe) {
    result = result.replace(/\+/g, "-").replace(/\//g, "_");
  }

  // Handle padding
  if (!padding) {
    result = result.replace(/=+$/, "");
  }

  // Handle MIME format (76 char line breaks)
  if (mimeFormat && result.length > 0) {
    const lines: string[] = [];
    for (let j = 0; j < result.length; j += 76) {
      lines.push(result.slice(j, j + 76));
    }
    return lines.join("\r\n");
  }

  return result;
}

// Decode base64 to bytes
export function decodeBase64(input: string): Uint8Array<ArrayBuffer> {
  // Remove whitespace and detect URL-safe variant
  const cleanInput = input.replace(/[\r\n\s]/g, "");
  const isUrlSafe = cleanInput.includes("-") || cleanInput.includes("_");

  // Convert URL-safe to standard if needed
  let normalizedInput = isUrlSafe
    ? cleanInput.replace(/-/g, "+").replace(/_/g, "/")
    : cleanInput;

  // Add padding if missing
  while (normalizedInput.length % 4 !== 0) {
    normalizedInput += "=";
  }

  // Use built-in atob for decoding
  try {
    const binary = atob(normalizedInput);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error("Invalid Base64 input");
  }
}

// Validate base64 string
export function isValidBase64(input: string): boolean {
  const cleanInput = input.replace(/[\r\n\s]/g, "");
  // Check for standard or URL-safe base64 characters
  const base64Regex = /^[A-Za-z0-9+/\-_]*=*$/;
  return base64Regex.test(cleanInput);
}
