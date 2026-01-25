import * as convertSourceMap from "convert-source-map";
import { SourceMapConsumer } from "source-map-js";
import type {
  RawSourceMap,
  SourceFile,
  SourceMapBundle,
  SourceTreeNode,
} from "./source-map-viewer-types";
import { downloadFile } from "@/lib/archiver/codec";

const INLINE_MAP_HINT = "sourceMappingURL=";

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeSourceRoot(sourceRoot: string | undefined | null): string {
  if (!sourceRoot) return "";
  return sourceRoot.endsWith("/") ? sourceRoot : `${sourceRoot}/`;
}

function isLikelyMapFile(name: string, content: string): boolean {
  if (name.toLowerCase().endsWith(".map")) return true;
  return content.trim().startsWith("{");
}

function joinSourceRoot(sourceRoot: string, source: string): string {
  if (!sourceRoot) return source;
  if (/^(data:|https?:|webpack:|file:)/i.test(source)) return source;

  const root = normalizeSourceRoot(sourceRoot);
  const trimmedSource = source.replace(/^\/+/, "");
  return `${root}${trimmedSource}`;
}

function normalizeSourcePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function buildSourceFiles(rawMap: RawSourceMap): SourceFile[] {
  const consumer = new SourceMapConsumer(rawMap);
  const sourceRoot = consumer.sourceRoot ?? rawMap.sourceRoot ?? "";

  return consumer.sources.map((source) => {
    const resolvedPath = normalizeSourcePath(
      joinSourceRoot(sourceRoot, source),
    );
    const content = consumer.sourceContentFor(source, true);
    return {
      id: generateId(),
      path: resolvedPath,
      content,
    };
  });
}

function parseRawMapFromJson(text: string): RawSourceMap {
  return convertSourceMap.fromJSON(text).toObject() as RawSourceMap;
}

export function parseSourceMapText(
  name: string,
  content: string,
): { bundle: SourceMapBundle | null; error: string | null } {
  try {
    let rawMap: RawSourceMap | null = null;

    if (isLikelyMapFile(name, content)) {
      rawMap = parseRawMapFromJson(content);
    } else if (content.includes(INLINE_MAP_HINT)) {
      const converter = convertSourceMap.fromSource(content);
      rawMap = converter ? (converter.toObject() as RawSourceMap) : null;
    }

    if (!rawMap || !rawMap.sources || rawMap.sources.length === 0) {
      return {
        bundle: null,
        error: "No sources found in source map.",
      };
    }

    const sources = buildSourceFiles(rawMap);

    return {
      bundle: {
        id: generateId(),
        name,
        sourceRoot: rawMap.sourceRoot ?? undefined,
        sources,
      },
      error: null,
    };
  } catch (error) {
    console.error("Source map parse failed", error);
    return {
      bundle: null,
      error:
        error instanceof Error ? error.message : "Failed to parse source map.",
    };
  }
}

export async function parseSourceMapsFromFiles(
  files: File[],
): Promise<{ bundles: SourceMapBundle[]; errors: string[] }> {
  const bundles: SourceMapBundle[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const content = await file.text();
      const { bundle, error } = parseSourceMapText(file.name, content);

      if (bundle) {
        bundles.push(bundle);
      } else {
        errors.push(`${file.name}: ${error ?? "No source map detected."}`);
      }
    } catch (error) {
      console.error("Source map upload failed", error);
      errors.push(`${file.name}: Failed to read file.`);
    }
  }

  return { bundles, errors };
}

function splitPathSegments(path: string): string[] {
  const normalized = normalizeSourcePath(path);
  const segments = normalized.split("/").filter(Boolean);
  return segments.length ? segments : [normalized];
}

export function buildSourceTree(bundles: SourceMapBundle[]): SourceTreeNode[] {
  return bundles.map((bundle) => {
    const rootNode: SourceTreeNode = {
      id: `map:${bundle.id}`,
      name: bundle.name,
      path: bundle.name,
      type: "directory",
      children: [],
    };

    for (const file of bundle.sources) {
      const segments = splitPathSegments(file.path);
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
            mapId: bundle.id,
          });
          return;
        }

        cursor.children = cursor.children ?? [];
        let next = cursor.children.find(
          (child) => child.type === "directory" && child.name === segment,
        );
        if (!next) {
          next = {
            id: `dir:${bundle.id}:${currentPath}`,
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

    return rootNode;
  });
}

function sanitizeZipPath(path: string): string {
  let normalized = normalizeSourcePath(path)
    .replace(/:\/+/, "/")
    .replace(/^[\/]+/, "");
  normalized = normalized.replace(/:\\?/g, "_");
  normalized = normalized.replace(/\?\?|\*|"|<|>|\|/g, "_");
  return normalized || "source";
}

export function downloadSourceFile(filename: string, content: string) {
  const data = new TextEncoder().encode(content);
  downloadFile(data, filename);
}

export async function downloadSourceMapZip(
  bundles: SourceMapBundle[],
  zipName: string,
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let addedCount = 0;

  for (const bundle of bundles) {
    const folderName = sanitizeZipPath(bundle.name);
    const folder = zip.folder(folderName) ?? zip;

    for (const source of bundle.sources) {
      if (source.content === null) continue;
      const filePath = sanitizeZipPath(source.path);
      folder.file(filePath, source.content);
      addedCount += 1;
    }
  }

  if (addedCount === 0) {
    return {
      ok: false as const,
      message: "No sources with embedded content to zip.",
    };
  }

  const data = await zip.generateAsync({ type: "uint8array" });
  downloadFile(data, zipName);
  return { ok: true as const, message: "" };
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  html: "html",
  htm: "html",
  vue: "html",
  svelte: "html",
  md: "markdown",
  markdown: "markdown",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
};

export function getLanguageFromPath(path: string): string {
  const cleaned = path.split("?")[0].split("#")[0];
  const parts = cleaned.split(".");
  const extension =
    parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  return LANGUAGE_BY_EXTENSION[extension] ?? "plaintext";
}
