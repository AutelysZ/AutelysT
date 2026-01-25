/**
 * Punycode encoder/decoder for Internationalized Domain Names (IDN)
 * Based on RFC 3492: https://www.rfc-editor.org/rfc/rfc3492
 */

// Bootstring parameters for Punycode
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = "-";

/** ASCII code for 'a' */
const BASE_A = 97;
/** ASCII code for '0' */
const BASE_0 = 48;

/**
 * Convert a digit to its basic code point
 */
function digitToBasic(digit: number): number {
  return digit < 26 ? digit + BASE_A : digit - 26 + BASE_0;
}

/**
 * Convert a basic code point to its digit value
 */
function basicToDigit(codePoint: number): number {
  if (codePoint >= BASE_0 && codePoint < BASE_0 + 10) {
    return codePoint - BASE_0 + 26;
  }
  if (codePoint >= BASE_A && codePoint < BASE_A + 26) {
    return codePoint - BASE_A;
  }
  if (codePoint >= 65 && codePoint < 91) {
    // Uppercase A-Z
    return codePoint - 65;
  }
  return BASE;
}

/**
 * Bias adaptation function
 */
function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);

  let k = 0;
  while (delta > ((BASE - TMIN) * TMAX) >> 1) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }

  return Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

/**
 * Encode a Unicode string to Punycode
 */
export function encodePunycode(input: string): string {
  const output: number[] = [];
  const inputLength = input.length;

  // Handle basic code points
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;

  // Copy basic code points to output
  for (let i = 0; i < inputLength; i++) {
    const c = input.charCodeAt(i);
    if (c < 0x80) {
      output.push(c);
    }
  }

  const basicLength = output.length;
  let handledCPCount = basicLength;

  // Add delimiter if there were basic code points
  if (basicLength > 0) {
    output.push(DELIMITER.charCodeAt(0));
  }

  // Main encoding loop
  while (handledCPCount < inputLength) {
    // Find the smallest non-basic code point >= n
    let m = 0x10ffff;
    for (let i = 0; i < inputLength; i++) {
      const c = input.codePointAt(i) || 0;
      if (c >= n && c < m) {
        m = c;
      }
    }

    // Increase delta enough to advance the decoder's <n,i> state to <m,0>
    if (m - n > Math.floor((0x7fffffff - delta) / (handledCPCount + 1))) {
      throw new Error("Punycode overflow");
    }
    delta += (m - n) * (handledCPCount + 1);
    n = m;

    // Process all code points in order
    for (let i = 0; i < inputLength; ) {
      const c = input.codePointAt(i) || 0;
      const charLength = c > 0xffff ? 2 : 1;
      i += charLength;

      if (c < n) {
        delta++;
        if (delta === 0) {
          throw new Error("Punycode overflow");
        }
      }

      if (c === n) {
        // Encode delta
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
          if (q < t) break;
          output.push(digitToBasic(t + ((q - t) % (BASE - t))));
          q = Math.floor((q - t) / (BASE - t));
        }
        output.push(digitToBasic(q));

        // Adapt bias
        bias = adapt(delta, handledCPCount + 1, handledCPCount === basicLength);
        delta = 0;
        handledCPCount++;
      }
    }

    delta++;
    n++;
  }

  return String.fromCharCode(...output);
}

/**
 * Decode a Punycode string to Unicode
 */
export function decodePunycode(input: string): string {
  const output: number[] = [];
  const inputLength = input.length;

  // Find the last delimiter
  let basic = input.lastIndexOf(DELIMITER);
  if (basic < 0) {
    basic = 0;
  }

  // Copy basic code points
  for (let i = 0; i < basic; i++) {
    const c = input.charCodeAt(i);
    if (c >= 0x80) {
      throw new Error("Invalid Punycode: non-basic character in basic portion");
    }
    output.push(c);
  }

  // Main decoding loop
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;

  for (let inputIdx = basic > 0 ? basic + 1 : 0; inputIdx < inputLength; ) {
    const oldi = i;

    for (let w = 1, k = BASE; ; k += BASE) {
      if (inputIdx >= inputLength) {
        throw new Error("Invalid Punycode: unexpected end of input");
      }

      const digit = basicToDigit(input.charCodeAt(inputIdx++));
      if (digit >= BASE) {
        throw new Error("Invalid Punycode: invalid digit");
      }

      if (digit > Math.floor((0x7fffffff - i) / w)) {
        throw new Error("Punycode overflow");
      }
      i += digit * w;

      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;

      if (w > Math.floor(0x7fffffff / (BASE - t))) {
        throw new Error("Punycode overflow");
      }
      w *= BASE - t;
    }

    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);

    if (Math.floor(i / out) > 0x7fffffff - n) {
      throw new Error("Punycode overflow");
    }
    n += Math.floor(i / out);
    i %= out;

    // Insert code point at position i
    output.splice(i, 0, n);
    i++;
  }

  return String.fromCodePoint(...output);
}

/**
 * Convert a Unicode domain to ASCII (IDNA encoding)
 */
export function toASCII(domain: string): string {
  return domain
    .split(".")
    .map((label) => {
      // Check if label contains non-ASCII characters
      const hasNonASCII = /[^\x00-\x7F]/.test(label);
      if (hasNonASCII) {
        return "xn--" + encodePunycode(label.toLowerCase());
      }
      return label;
    })
    .join(".");
}

/**
 * Convert an ASCII domain to Unicode (IDNA decoding)
 */
export function toUnicode(domain: string): string {
  return domain
    .split(".")
    .map((label) => {
      if (label.toLowerCase().startsWith("xn--")) {
        return decodePunycode(label.slice(4));
      }
      return label;
    })
    .join(".");
}

/**
 * Check if a string is valid Punycode
 */
export function isValidPunycode(input: string): boolean {
  try {
    decodePunycode(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a domain appears to be IDN encoded (contains xn-- labels)
 */
export function isIDNEncoded(domain: string): boolean {
  return domain
    .split(".")
    .some((label) => label.toLowerCase().startsWith("xn--"));
}
