import type { SourceTreeNode } from "../source-map-viewer/source-map-viewer-types";
import { downloadFile } from "@/lib/archiver/codec";
import type { FormatterFile } from "./code-formatter-types";

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function normalizeFilePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function splitPathSegments(path: string): string[] {
  const normalized = normalizeFilePath(path);
  const segments = normalized.split("/").filter(Boolean);
  return segments.length ? segments : [normalized];
}

export function buildFileTree(files: FormatterFile[]): SourceTreeNode[] {
  if (files.length === 0) return [];
  const rootNode: SourceTreeNode = {
    id: "root",
    name: "Workspace",
    path: "Workspace",
    type: "directory",
    children: [],
  };

  for (const file of files) {
    const segments = splitPathSegments(file.path || "untitled");
    let cursor = rootNode;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (index === segments.length - 1) {
        cursor.children = cursor.children ?? [];
        cursor.children.push({
          id: `file:${file.id}`,
          name: segment,
          path: currentPath,
          type: "file",
          fileId: file.id,
        });
        return;
      }

      cursor.children = cursor.children ?? [];
      let next = cursor.children.find(
        (child) => child.type === "directory" && child.name === segment,
      );
      if (!next) {
        next = {
          id: `dir:${currentPath}`,
          name: segment,
          path: currentPath,
          type: "directory",
          children: [],
        };
        cursor.children.push(next);
      }
      cursor = next;
    });
  }

  return [rootNode];
}

export function parseFilesJson(value: string): {
  files: FormatterFile[];
  error: string | null;
} {
  if (!value) return { files: [], error: null };

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { files: [], error: "Invalid file list." };
    }
    const files = parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        return {
          id: String(entry.id || generateId()),
          path: String(entry.path || "untitled"),
          content: String(entry.content || ""),
        } satisfies FormatterFile;
      })
      .filter(Boolean) as FormatterFile[];
    return { files, error: null };
  } catch (error) {
    console.error("Failed to parse file list", error);
    return { files: [], error: "Failed to parse file list." };
  }
}

export function serializeFiles(files: FormatterFile[]): string {
  return JSON.stringify(files);
}

function sanitizeZipPath(path: string): string {
  let normalized = normalizeFilePath(path)
    .replace(/:\\/g, "_")
    .replace(/^\/+/, "")
    .replace(/\?\?|\*|"|<|>|\|/g, "_");
  normalized = normalized.replace(/:$/g, "");
  return normalized || "file";
}

export function downloadFormatterFile(path: string, content: string) {
  const fileName = path.split("/").pop() || "formatted.txt";
  const data = new TextEncoder().encode(content);
  downloadFile(data, fileName);
}

export async function downloadFormatterZip(
  files: FormatterFile[],
  zipName: string,
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let addedCount = 0;

  for (const file of files) {
    const filePath = sanitizeZipPath(file.path || "untitled.txt");
    zip.file(filePath, file.content ?? "");
    addedCount += 1;
  }

  if (addedCount === 0) {
    return { ok: false as const, message: "No files to download." };
  }

  const data = await zip.generateAsync({ type: "uint8array" });
  downloadFile(data, zipName);
  return { ok: true as const, message: "" };
}
