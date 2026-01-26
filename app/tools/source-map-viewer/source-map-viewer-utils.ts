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
  const root: SourceTreeNode = {
    id: "root",
    name: "root",
    path: "",
    type: "directory",
    children: [],
  };

  for (const bundle of bundles) {
    const mapPath = normalizeSourcePath(bundle.name);
    const segments = splitPathSegments(mapPath);
    const mapFileName = segments.pop() ?? mapPath;
    let cursor = root;
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      cursor.children = cursor.children ?? [];
      let next = cursor.children.find(
        (child) => child.type === "directory" && child.name === segment,
      );
      if (!next) {
        next = {
          id: `dir:map:${currentPath}`,
          name: segment,
          path: currentPath,
          type: "directory",
          children: [],
        };
        cursor.children.push(next);
      }
      cursor = next;
    }

    const mapNode: SourceTreeNode = {
      id: `map:${bundle.id}`,
      name: mapFileName,
      path: mapPath,
      type: "directory",
      kind: "map-root",
      children: [],
    };

    for (const file of bundle.sources) {
      const sourceSegments = splitPathSegments(file.path);
      let sourceCursor = mapNode;
      let sourcePath = "";

      sourceSegments.forEach((segment, index) => {
        sourcePath = sourcePath ? `${sourcePath}/${segment}` : segment;

        if (index === sourceSegments.length - 1) {
          sourceCursor.children = sourceCursor.children ?? [];
          sourceCursor.children.push({
            id: `file:${file.id}`,
            name: segment,
            path: sourcePath,
            type: "file",
            kind: "source-file",
            fileId: file.id,
            mapId: bundle.id,
          });
          return;
        }

        sourceCursor.children = sourceCursor.children ?? [];
        let next = sourceCursor.children.find(
          (child) => child.type === "directory" && child.name === segment,
        );
        if (!next) {
          next = {
            id: `dir:${bundle.id}:${sourcePath}`,
            name: segment,
            path: sourcePath,
            type: "directory",
            kind: "source-dir",
            children: [],
          };
          sourceCursor.children.push(next);
        }
        sourceCursor = next;
      });
    }

    cursor.children = cursor.children ?? [];
    cursor.children.push(mapNode);
  }

  return root.children ?? [];
}

function sanitizeZipSegment(segment: string): string {
  const cleaned = segment
    .replace(/^\.+$/g, "_")
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .replace(/[\\:*?"<>|]+/g, "_")
    .trim();
  return cleaned || "_";
}

function sanitizeZipPath(path: string): string {
  const normalized = normalizeSourcePath(path)
    .replace(/:\/+/, "/")
    .replace(/^[\/]+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const safeSegments: string[] = [];

  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === "..") {
      safeSegments.pop();
      continue;
    }
    safeSegments.push(sanitizeZipSegment(segment));
  }

  return safeSegments.join("/") || "source";
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
  const usedFolderNames = new Map<string, number>();

  for (const bundle of bundles) {
    const baseFolderName = sanitizeZipPath(bundle.name) || "source-map";
    const existingCount = usedFolderNames.get(baseFolderName) ?? 0;
    usedFolderNames.set(baseFolderName, existingCount + 1);
    const folderName =
      existingCount === 0
        ? baseFolderName
        : `${baseFolderName}__${existingCount + 1}`;
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

export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  json5: "json",
  jsonc: "json",
  txt: "plaintext",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  html: "html",
  htm: "html",
  vue: "html",
  svelte: "html",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  conf: "ini",
  cfg: "ini",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ksh: "shell",
  ps1: "powershell",
  php: "php",
  phtml: "php",
  java: "java",
  go: "go",
  py: "python",
  rb: "ruby",
  rs: "rust",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  cs: "csharp",
  c: "c",
  h: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  sql: "sql",
  gql: "graphql",
  graphql: "graphql",
};

export function getLanguageFromPath(path: string): string {
  const cleaned = path.split("?")[0].split("#")[0];
  const parts = cleaned.split(".");
  const extension =
    parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  return LANGUAGE_BY_EXTENSION[extension] ?? "plaintext";
}
