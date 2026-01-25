// Color conversion library supporting multiple color formats

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
  a: number; // 0-1
}

export interface HWB {
  h: number; // 0-360
  w: number; // 0-100 (whiteness)
  b: number; // 0-100 (blackness)
  a: number; // 0-1
}

export interface LAB {
  l: number; // 0-100
  a: number; // -128 to 127
  b: number; // -128 to 127
  alpha: number; // 0-1
}

export interface LCH {
  l: number; // 0-100
  c: number; // 0-150+
  h: number; // 0-360
  a: number; // 0-1
}

export interface OKLAB {
  l: number; // 0-1
  a: number; // -0.4 to 0.4
  b: number; // -0.4 to 0.4
  alpha: number; // 0-1
}

export interface OKLCH {
  l: number; // 0-1
  c: number; // 0-0.4+
  h: number; // 0-360
  a: number; // 0-1
}

export interface CMYK {
  c: number; // 0-100
  m: number; // 0-100
  y: number; // 0-100
  k: number; // 0-100
  a: number; // 0-1
}

// Parse any color string to RGB
export function parseColor(input: string): RGB | null {
  const trimmed = input.trim().toLowerCase();

  // Try hex
  const hex = parseHex(trimmed);
  if (hex) return hex;

  // Try rgb/rgba
  const rgb = parseRgb(trimmed);
  if (rgb) return rgb;

  // Try hsl/hsla
  const hsl = parseHsl(trimmed);
  if (hsl) return hslToRgb(hsl);

  // Try hwb
  const hwb = parseHwb(trimmed);
  if (hwb) return hwbToRgb(hwb);

  // Try named colors
  const named = parseNamedColor(trimmed);
  if (named) return named;

  // Try lab
  const lab = parseLab(trimmed);
  if (lab) return labToRgb(lab);

  // Try lch
  const lch = parseLch(trimmed);
  if (lch) return lchToRgb(lch);

  // Try oklab
  const oklab = parseOklab(trimmed);
  if (oklab) return oklabToRgb(oklab);

  // Try oklch
  const oklch = parseOklch(trimmed);
  if (oklch) return oklchToRgb(oklch);

  return null;
}

// Parse hex color
function parseHex(input: string): RGB | null {
  const match = input.match(/^#?([0-9a-f]{3,8})$/i);
  if (!match) return null;

  const hex = match[1];
  let r: number,
    g: number,
    b: number,
    a = 1;

  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 4) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
    a = parseInt(hex[3] + hex[3], 16) / 255;
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6, 8), 16) / 255;
  } else {
    return null;
  }

  return { r, g, b, a };
}

// Parse rgb/rgba
function parseRgb(input: string): RGB | null {
  const match = input.match(/^rgba?\s*\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const parseValue = (v: string, max: number): number => {
    if (v.endsWith("%")) {
      return (parseFloat(v) / 100) * max;
    }
    return parseFloat(v);
  };

  const r = Math.round(parseValue(parts[0], 255));
  const g = Math.round(parseValue(parts[1], 255));
  const b = Math.round(parseValue(parts[2], 255));
  let a = 1;

  if (parts.length >= 4) {
    a = parts[3].endsWith("%")
      ? parseFloat(parts[3]) / 100
      : parseFloat(parts[3]);
  }

  if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
    a: clamp(a, 0, 1),
  };
}

// Parse hsl/hsla
function parseHsl(input: string): HSL | null {
  const match = input.match(/^hsla?\s*\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  let h = parseFloat(parts[0]);
  if (parts[0].endsWith("deg")) h = parseFloat(parts[0]);
  else if (parts[0].endsWith("rad")) h = parseFloat(parts[0]) * (180 / Math.PI);
  else if (parts[0].endsWith("turn")) h = parseFloat(parts[0]) * 360;

  const s = parseFloat(parts[1]);
  const l = parseFloat(parts[2]);
  let a = 1;

  if (parts.length >= 4) {
    a = parts[3].endsWith("%")
      ? parseFloat(parts[3]) / 100
      : parseFloat(parts[3]);
  }

  if (isNaN(h) || isNaN(s) || isNaN(l) || isNaN(a)) return null;

  return {
    h: ((h % 360) + 360) % 360,
    s: clamp(s, 0, 100),
    l: clamp(l, 0, 100),
    a: clamp(a, 0, 1),
  };
}

// Parse hwb
function parseHwb(input: string): HWB | null {
  const match = input.match(/^hwb\s*\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  let h = parseFloat(parts[0]);
  const w = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  let a = 1;

  if (parts.length >= 4) {
    a = parts[3].endsWith("%")
      ? parseFloat(parts[3]) / 100
      : parseFloat(parts[3]);
  }

  if (isNaN(h) || isNaN(w) || isNaN(b) || isNaN(a)) return null;

  return {
    h: ((h % 360) + 360) % 360,
    w: clamp(w, 0, 100),
    b: clamp(b, 0, 100),
    a: clamp(a, 0, 1),
  };
}

// Parse lab
function parseLab(input: string): LAB | null {
  const match = input.match(/^lab\s*\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const l = parseFloat(parts[0]);
  const a = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  let alpha = 1;

  if (parts.length >= 4) {
    alpha = parts[3].endsWith("%")
      ? parseFloat(parts[3]) / 100
      : parseFloat(parts[3]);
  }

  if (isNaN(l) || isNaN(a) || isNaN(b) || isNaN(alpha)) return null;

  return { l: clamp(l, 0, 100), a, b, alpha: clamp(alpha, 0, 1) };
}

// Parse lch
function parseLch(input: string): LCH | null {
  const match = input.match(/^lch\s*\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const l = parseFloat(parts[0]);
  const c = parseFloat(parts[1]);
  let h = parseFloat(parts[2]);
  let a = 1;

  if (parts.length >= 4) {
    a = parts[3].endsWith("%")
      ? parseFloat(parts[3]) / 100
      : parseFloat(parts[3]);
  }

  if (isNaN(l) || isNaN(c) || isNaN(h) || isNaN(a)) return null;

  return {
    l: clamp(l, 0, 100),
    c: Math.max(0, c),
    h: ((h % 360) + 360) % 360,
    a: clamp(a, 0, 1),
  };
}

// Parse oklab
function parseOklab(input: string): OKLAB | null {
  const match = input.match(/^oklab\s*\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  let l = parseFloat(parts[0]);
  if (parts[0].endsWith("%")) l = parseFloat(parts[0]) / 100;

  const a = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  let alpha = 1;

  if (parts.length >= 4) {
    alpha = parts[3].endsWith("%")
      ? parseFloat(parts[3]) / 100
      : parseFloat(parts[3]);
  }

  if (isNaN(l) || isNaN(a) || isNaN(b) || isNaN(alpha)) return null;

  return { l: clamp(l, 0, 1), a, b, alpha: clamp(alpha, 0, 1) };
}

// Parse oklch
function parseOklch(input: string): OKLCH | null {
  const match = input.match(/^oklch\s*\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  let l = parseFloat(parts[0]);
  if (parts[0].endsWith("%")) l = parseFloat(parts[0]) / 100;

  const c = parseFloat(parts[1]);
  let h = parseFloat(parts[2]);
  let a = 1;

  if (parts.length >= 4) {
    a = parts[3].endsWith("%")
      ? parseFloat(parts[3]) / 100
      : parseFloat(parts[3]);
  }

  if (isNaN(l) || isNaN(c) || isNaN(h) || isNaN(a)) return null;

  return {
    l: clamp(l, 0, 1),
    c: Math.max(0, c),
    h: ((h % 360) + 360) % 360,
    a: clamp(a, 0, 1),
  };
}

// Named colors (subset of CSS named colors)
const NAMED_COLORS: Record<string, RGB> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  yellow: { r: 255, g: 255, b: 0, a: 1 },
  cyan: { r: 0, g: 255, b: 255, a: 1 },
  magenta: { r: 255, g: 0, b: 255, a: 1 },
  orange: { r: 255, g: 165, b: 0, a: 1 },
  purple: { r: 128, g: 0, b: 128, a: 1 },
  pink: { r: 255, g: 192, b: 203, a: 1 },
  brown: { r: 165, g: 42, b: 42, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
  lime: { r: 0, g: 255, b: 0, a: 1 },
  navy: { r: 0, g: 0, b: 128, a: 1 },
  teal: { r: 0, g: 128, b: 128, a: 1 },
  olive: { r: 128, g: 128, b: 0, a: 1 },
  maroon: { r: 128, g: 0, b: 0, a: 1 },
  aqua: { r: 0, g: 255, b: 255, a: 1 },
  fuchsia: { r: 255, g: 0, b: 255, a: 1 },
  silver: { r: 192, g: 192, b: 192, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

function parseNamedColor(input: string): RGB | null {
  return NAMED_COLORS[input] || null;
}

// Conversion functions
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: hsl.a,
  };
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: rgb.a,
  };
}

export function hwbToRgb(hwb: HWB): RGB {
  const h = hwb.h;
  const w = hwb.w / 100;
  const b = hwb.b / 100;

  // Normalize if w + b > 1
  const sum = w + b;
  const wn = sum > 1 ? w / sum : w;
  const bn = sum > 1 ? b / sum : b;

  const rgb = hslToRgb({ h, s: 100, l: 50, a: hwb.a });

  rgb.r = Math.round(rgb.r * (1 - wn - bn) + wn * 255);
  rgb.g = Math.round(rgb.g * (1 - wn - bn) + wn * 255);
  rgb.b = Math.round(rgb.b * (1 - wn - bn) + wn * 255);

  return rgb;
}

export function rgbToHwb(rgb: RGB): HWB {
  const hsl = rgbToHsl(rgb);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const w = Math.min(r, g, b);
  const bk = 1 - Math.max(r, g, b);

  return {
    h: hsl.h,
    w: Math.round(w * 100),
    b: Math.round(bk * 100),
    a: rgb.a,
  };
}

// LAB/LCH conversions (using D65 illuminant)
function rgbToXyz(rgb: RGB): { x: number; y: number; z: number } {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // sRGB to linear RGB
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Linear RGB to XYZ (D65)
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  return { x, y, z };
}

function xyzToRgb(xyz: { x: number; y: number; z: number }): {
  r: number;
  g: number;
  b: number;
} {
  // XYZ to linear RGB
  let r = xyz.x * 3.2404542 + xyz.y * -1.5371385 + xyz.z * -0.4985314;
  let g = xyz.x * -0.969266 + xyz.y * 1.8760108 + xyz.z * 0.041556;
  let b = xyz.x * 0.0556434 + xyz.y * -0.2040259 + xyz.z * 1.0572252;

  // Linear RGB to sRGB
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return {
    r: Math.round(clamp(r * 255, 0, 255)),
    g: Math.round(clamp(g * 255, 0, 255)),
    b: Math.round(clamp(b * 255, 0, 255)),
  };
}

// D65 reference white
const D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

export function rgbToLab(rgb: RGB): LAB {
  const xyz = rgbToXyz(rgb);

  let x = xyz.x / D65.x;
  let y = xyz.y / D65.y;
  let z = xyz.z / D65.z;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;

  return {
    l: Math.round((116 * y - 16) * 100) / 100,
    a: Math.round(500 * (x - y) * 100) / 100,
    b: Math.round(200 * (y - z) * 100) / 100,
    alpha: rgb.a,
  };
}

export function labToRgb(lab: LAB): RGB {
  const epsilon = 0.008856;
  const kappa = 903.3;

  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const x =
    Math.pow(fx, 3) > epsilon ? Math.pow(fx, 3) : (116 * fx - 16) / kappa;
  const y = lab.l > kappa * epsilon ? Math.pow(fy, 3) : lab.l / kappa;
  const z =
    Math.pow(fz, 3) > epsilon ? Math.pow(fz, 3) : (116 * fz - 16) / kappa;

  const xyz = { x: x * D65.x, y: y * D65.y, z: z * D65.z };
  const rgb = xyzToRgb(xyz);

  return { ...rgb, a: lab.alpha };
}

export function rgbToLch(rgb: RGB): LCH {
  const lab = rgbToLab(rgb);
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return {
    l: lab.l,
    c: Math.round(c * 100) / 100,
    h: Math.round(h * 100) / 100,
    a: rgb.a,
  };
}

export function lchToRgb(lch: LCH): RGB {
  const hRad = lch.h * (Math.PI / 180);
  const lab: LAB = {
    l: lch.l,
    a: lch.c * Math.cos(hRad),
    b: lch.c * Math.sin(hRad),
    alpha: lch.a,
  };
  return labToRgb(lab);
}

// OKLAB/OKLCH conversions
export function rgbToOklab(rgb: RGB): OKLAB {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // sRGB to linear
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  return {
    l:
      Math.round(
        (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * 1000,
      ) / 1000,
    a:
      Math.round(
        (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * 1000,
      ) / 1000,
    b:
      Math.round(
        (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) * 1000,
      ) / 1000,
    alpha: rgb.a,
  };
}

export function oklabToRgb(oklab: OKLAB): RGB {
  const l_ = oklab.l + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
  const m_ = oklab.l - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
  const s_ = oklab.l - 0.0894841775 * oklab.a - 1.291485548 * oklab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  // Linear to sRGB
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return {
    r: Math.round(clamp(r * 255, 0, 255)),
    g: Math.round(clamp(g * 255, 0, 255)),
    b: Math.round(clamp(b * 255, 0, 255)),
    a: oklab.alpha,
  };
}

export function rgbToOklch(rgb: RGB): OKLCH {
  const oklab = rgbToOklab(rgb);
  const c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b);
  let h = Math.atan2(oklab.b, oklab.a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return {
    l: oklab.l,
    c: Math.round(c * 1000) / 1000,
    h: Math.round(h * 100) / 100,
    a: rgb.a,
  };
}

export function oklchToRgb(oklch: OKLCH): RGB {
  const hRad = oklch.h * (Math.PI / 180);
  const oklab: OKLAB = {
    l: oklch.l,
    a: oklch.c * Math.cos(hRad),
    b: oklch.c * Math.sin(hRad),
    alpha: oklch.a,
  };
  return oklabToRgb(oklab);
}

// CMYK conversion (simplified, not color-managed)
export function rgbToCmyk(rgb: RGB): CMYK {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const k = 1 - Math.max(r, g, b);

  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100, a: rgb.a };
  }

  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
    a: rgb.a,
  };
}

export function cmykToRgb(cmyk: CMYK): RGB {
  const c = cmyk.c / 100;
  const m = cmyk.m / 100;
  const y = cmyk.y / 100;
  const k = cmyk.k / 100;

  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    a: cmyk.a,
  };
}

// Format output functions
export function toHex(rgb: RGB): string {
  const r = rgb.r.toString(16).padStart(2, "0");
  const g = rgb.g.toString(16).padStart(2, "0");
  const b = rgb.b.toString(16).padStart(2, "0");

  if (rgb.a < 1) {
    const a = Math.round(rgb.a * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  }

  return `#${r}${g}${b}`;
}

export function toRgb(rgb: RGB): string {
  if (rgb.a < 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(rgb.a, 2)})`;
  }
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function toRgbModern(rgb: RGB): string {
  if (rgb.a < 1) {
    return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${round(rgb.a * 100, 0)}%)`;
  }
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b})`;
}

export function toHsl(rgb: RGB): string {
  const hsl = rgbToHsl(rgb);
  if (hsl.a < 1) {
    return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${round(hsl.a, 2)})`;
  }
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

export function toHslModern(rgb: RGB): string {
  const hsl = rgbToHsl(rgb);
  if (hsl.a < 1) {
    return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}% / ${round(hsl.a * 100, 0)}%)`;
  }
  return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;
}

export function toHwb(rgb: RGB): string {
  const hwb = rgbToHwb(rgb);
  if (hwb.a < 1) {
    return `hwb(${hwb.h} ${hwb.w}% ${hwb.b}% / ${round(hwb.a * 100, 0)}%)`;
  }
  return `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%)`;
}

export function toLab(rgb: RGB): string {
  const lab = rgbToLab(rgb);
  if (lab.alpha < 1) {
    return `lab(${lab.l}% ${lab.a} ${lab.b} / ${round(lab.alpha * 100, 0)}%)`;
  }
  return `lab(${lab.l}% ${lab.a} ${lab.b})`;
}

export function toLch(rgb: RGB): string {
  const lch = rgbToLch(rgb);
  if (lch.a < 1) {
    return `lch(${lch.l}% ${lch.c} ${lch.h} / ${round(lch.a * 100, 0)}%)`;
  }
  return `lch(${lch.l}% ${lch.c} ${lch.h})`;
}

export function toOklab(rgb: RGB): string {
  const oklab = rgbToOklab(rgb);
  if (oklab.alpha < 1) {
    return `oklab(${round(oklab.l * 100, 1)}% ${oklab.a} ${oklab.b} / ${round(oklab.alpha * 100, 0)}%)`;
  }
  return `oklab(${round(oklab.l * 100, 1)}% ${oklab.a} ${oklab.b})`;
}

export function toOklch(rgb: RGB): string {
  const oklch = rgbToOklch(rgb);
  if (oklch.a < 1) {
    return `oklch(${round(oklch.l * 100, 1)}% ${oklch.c} ${oklch.h} / ${round(oklch.a * 100, 0)}%)`;
  }
  return `oklch(${round(oklch.l * 100, 1)}% ${oklch.c} ${oklch.h})`;
}

export function toColor(rgb: RGB): string {
  const r = round(rgb.r / 255, 4);
  const g = round(rgb.g / 255, 4);
  const b = round(rgb.b / 255, 4);
  if (rgb.a < 1) {
    return `color(srgb ${r} ${g} ${b} / ${round(rgb.a * 100, 0)}%)`;
  }
  return `color(srgb ${r} ${g} ${b})`;
}

export function toColorMix(rgb: RGB): string {
  const hex = toHex(rgb);
  if (rgb.a < 1) {
    return `color-mix(in srgb, ${hex} ${round(rgb.a * 100, 0)}%, transparent)`;
  }
  return `color-mix(in srgb, ${hex} 100%, transparent)`;
}

export function toDeviceCmyk(rgb: RGB): string {
  const cmyk = rgbToCmyk(rgb);
  if (cmyk.a < 1) {
    return `device-cmyk(${cmyk.c}% ${cmyk.m}% ${cmyk.y}% ${cmyk.k}% / ${round(cmyk.a * 100, 0)}%)`;
  }
  return `device-cmyk(${cmyk.c}% ${cmyk.m}% ${cmyk.y}% ${cmyk.k}%)`;
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// All format outputs
export interface ColorFormats {
  hex: string;
  rgb: string;
  rgba: string;
  hsl: string;
  hsla: string;
  hwb: string;
  lab: string;
  lch: string;
  oklab: string;
  oklch: string;
  color: string;
  colorMix: string;
  deviceCmyk: string;
}

export function getAllFormats(rgb: RGB): ColorFormats {
  const hsl = rgbToHsl(rgb);

  return {
    hex: toHex(rgb),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    rgba: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(rgb.a, 2)})`,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    hsla: `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${round(rgb.a, 2)})`,
    hwb: toHwb(rgb),
    lab: toLab(rgb),
    lch: toLch(rgb),
    oklab: toOklab(rgb),
    oklch: toOklch(rgb),
    color: toColor(rgb),
    colorMix: toColorMix(rgb),
    deviceCmyk: toDeviceCmyk(rgb),
  };
}
