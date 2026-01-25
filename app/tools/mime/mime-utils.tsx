"use client";

import mimeDb from "mime-db";
import mimeScore from "mime-score";

type MimeDbEntry = {
  extensions?: string[];
  source?: string;
};

const mimeEntries = mimeDb as Record<string, MimeDbEntry>;
const extensionToMime = new Map<string, string>();
const mimeToExtensions = new Map<string, string[]>();

export const mimeTypeOptions = Object.keys(mimeEntries).sort();

// Prefer the most official MIME type when multiple share an extension.
for (const [type, entry] of Object.entries(mimeEntries)) {
  if (!entry.extensions || entry.extensions.length === 0) continue;
  mimeToExtensions.set(type, entry.extensions);
  for (const extension of entry.extensions) {
    const ext = extension.toLowerCase();
    const current = extensionToMime.get(ext);
    if (!current) {
      extensionToMime.set(ext, type);
      continue;
    }
    const currentEntry = mimeEntries[current];
    const currentScore = mimeScore(current, currentEntry?.source);
    const nextScore = mimeScore(type, entry.source);
    if (nextScore > currentScore) {
      extensionToMime.set(ext, type);
    }
  }
}

export function normalizeMimeInput(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function getExtensionFromFilename(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(".") && !/[\\/]/.test(trimmed)) {
    const ext = trimmed.slice(1).trim();
    if (!ext || ext.endsWith(".")) return "";
    return ext.split(".").pop()?.toLowerCase() ?? "";
  }
  const base = trimmed.split(/[/\\]/).pop() ?? trimmed;
  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === base.length - 1) return "";
  return base.slice(lastDot + 1).toLowerCase();
}

export function getMimeTypeFromFilename(value: string) {
  const ext = getExtensionFromFilename(value);
  const mime = ext ? extensionToMime.get(ext) ?? "" : "";
  return { mime, ext };
}

export function getExtensionsForMime(value: string) {
  const normalized = normalizeMimeInput(value);
  if (!normalized) return [];
  return mimeToExtensions.get(normalized) ?? [];
}

export function isKnownMimeType(value: string) {
  const normalized = normalizeMimeInput(value);
  if (!normalized) return false;
  return Boolean(mimeEntries[normalized]);
}
