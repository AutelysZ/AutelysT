"use client";

import * as React from "react";
import { fileTypeFromBlob } from "file-type";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import type {
  DetectedFileType,
  FileRecord,
  FileTreeNode,
  PreviewState,
} from "./file-type-detector-types";
import FileTypeDetectorForm from "./file-type-detector-form";

const MAX_TEXT_PREVIEW_BYTES = 200 * 1024;
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "csv",
  "log",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "svg",
]);
const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogv",
  "mov",
  "m4v",
  "avi",
  "mkv",
]);
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
  "tif",
  "tiff",
]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const PDF_EXTENSIONS = new Set(["pdf"]);

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function splitPathSegments(path: string): string[] {
  const normalized = normalizePath(path);
  const segments = normalized.split("/").filter(Boolean);
  return segments.length ? segments : [normalized];
}

function buildFileTree(records: FileRecord[]): FileTreeNode[] {
  const roots: FileTreeNode[] = [];

  for (const record of records) {
    const segments = splitPathSegments(record.path || record.name);
    let cursor = roots;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;

      if (isLeaf) {
        cursor.push({
          id: `file:${record.id}`,
          name: segment,
          path: currentPath,
          type: "file",
          fileId: record.id,
        });
        return;
      }

      let next = cursor.find(
        (node) => node.type === "directory" && node.name === segment,
      );
      if (!next) {
        next = {
          id: `dir:${currentPath}`,
          name: segment,
          path: currentPath,
          type: "directory",
          children: [],
        };
        cursor.push(next);
      }
      if (!next.children) next.children = [];
      cursor = next.children;
    });
  }

  return roots;
}

function getExtension(name: string) {
  const trimmed = name.trim();
  const index = trimmed.lastIndexOf(".");
  if (index === -1) return "";
  return trimmed.slice(index + 1).toLowerCase();
}

function isTextMime(mime: string) {
  if (!mime) return false;
  if (mime.startsWith("text/")) return true;
  if (mime.endsWith("+json") || mime.endsWith("+xml")) return true;
  return [
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "application/x-typescript",
  ].includes(mime);
}

function isPdfType(mime: string, ext: string) {
  return mime === "application/pdf" || PDF_EXTENSIONS.has(ext);
}

function isHeicType(mime: string, ext: string) {
  return (
    mime === "image/heic" || mime === "image/heif" || HEIC_EXTENSIONS.has(ext)
  );
}

function getPreviewKind(
  mime: string,
  fileName: string,
  detectedExt?: string,
): PreviewState["kind"] {
  const ext = detectedExt || getExtension(fileName);

  if (isPdfType(mime, ext)) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (isTextMime(mime)) return "text";

  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (IMAGE_EXTENSIONS.has(ext) || HEIC_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (PDF_EXTENSIONS.has(ext)) return "pdf";
  return "none";
}

export default function FileTypeDetectorContent() {
  const [files, setFiles] = React.useState<FileRecord[]>([]);
  const [activeFileId, setActiveFileId] = React.useState("");
  const [preview, setPreview] = React.useState<PreviewState>({ kind: "none" });
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const detectIdRef = React.useRef(0);
  const previewIdRef = React.useRef(0);
  const previewUrlRef = React.useRef<string | null>(null);

  const activeFile = React.useMemo(
    () => files.find((item) => item.id === activeFileId) ?? null,
    [files, activeFileId],
  );
  const treeNodes = React.useMemo(() => buildFileTree(files), [files]);
  const isLoading = isDetecting || isPreviewLoading;

  const revokePreviewUrl = React.useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const readTextPreview = React.useCallback(async (targetFile: File) => {
    const blob = targetFile.slice(0, MAX_TEXT_PREVIEW_BYTES);
    const content = await blob.text();
    const truncated = targetFile.size > MAX_TEXT_PREVIEW_BYTES;
    return { content, truncated };
  }, []);

  const processFiles = React.useCallback(
    async (incoming: File[], mode: "append" | "replace") => {
      if (incoming.length === 0) return;

      const detectId = detectIdRef.current + 1;
      detectIdRef.current = detectId;
      setIsDetecting(true);
      setError(null);

      const results = await Promise.all(
        incoming.map(async (file) => {
          let detectedType: DetectedFileType = null;
          let hadError = false;
          try {
            detectedType = (await fileTypeFromBlob(file)) ?? null;
          } catch (err) {
            console.error("File type detection failed", err);
            hadError = true;
          }
          const relativePath =
            (file as File & { webkitRelativePath?: string })
              .webkitRelativePath || file.name;
          const record: FileRecord = {
            id: generateId(),
            file,
            name: file.name,
            path: normalizePath(relativePath) || file.name,
            size: file.size,
            lastModified: file.lastModified,
            detectedType,
          };
          return { record, hadError };
        }),
      );

      if (detectIdRef.current !== detectId) return;

      if (results.some((item) => item.hadError)) {
        setError("Failed to detect some files.");
      }

      const records = results.map((item) => item.record);
      setFiles((prev) =>
        mode === "replace" ? records : [...prev, ...records],
      );
      setIsDetecting(false);

      if (records.length > 0) {
        setActiveFileId(records[0].id);
      } else if (mode === "replace") {
        setActiveFileId("");
      }
    },
    [],
  );

  const resetState = React.useCallback(() => {
    revokePreviewUrl();
    detectIdRef.current += 1;
    previewIdRef.current += 1;
    setFiles([]);
    setActiveFileId("");
    setPreview({ kind: "none" });
    setIsDetecting(false);
    setIsPreviewLoading(false);
    setError(null);
  }, [revokePreviewUrl]);

  const handleFilesUpload = React.useCallback(
    async (incoming: File[]) => {
      await processFiles(incoming, "append");
    },
    [processFiles],
  );

  const handleClear = React.useCallback(() => {
    resetState();
  }, [resetState]);

  React.useEffect(() => {
    return () => {
      revokePreviewUrl();
    };
  }, [revokePreviewUrl]);

  React.useEffect(() => {
    if (files.length === 0) {
      if (activeFileId) setActiveFileId("");
      return;
    }
    const exists = files.some((item) => item.id === activeFileId);
    if (!exists) {
      setActiveFileId(files[0]?.id ?? "");
    }
  }, [activeFileId, files]);

  React.useEffect(() => {
    const previewId = previewIdRef.current + 1;
    previewIdRef.current = previewId;
    revokePreviewUrl();

    if (!activeFile) {
      setPreview({ kind: "none" });
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    setError(null);

    const file = activeFile.file;
    const detected = activeFile.detectedType;
    const mime = detected?.mime || file.type || "";
    const ext = detected?.ext || getExtension(file.name);
    const previewKind = getPreviewKind(mime, file.name, ext);

    const applyPreview = (next: PreviewState) => {
      if (previewIdRef.current !== previewId) return;
      setPreview(next);
      setIsPreviewLoading(false);
    };

    const applyError = (message: string) => {
      if (previewIdRef.current !== previewId) return;
      setError(message);
      setPreview({ kind: "none" });
      setIsPreviewLoading(false);
    };

    if (previewKind === "text") {
      readTextPreview(file)
        .then((textPreview) => {
          if (previewIdRef.current !== previewId) return;
          applyPreview({
            kind: "text",
            content: textPreview.content,
            truncated: textPreview.truncated,
          });
        })
        .catch((err) => {
          console.error("Failed to read text preview", err);
          applyError("Failed to read text preview.");
        });
      return;
    }

    if (previewKind === "pdf") {
      const url = URL.createObjectURL(file);
      if (previewIdRef.current !== previewId) {
        URL.revokeObjectURL(url);
        return;
      }
      previewUrlRef.current = url;
      applyPreview({ kind: "pdf", url });
      return;
    }

    if (previewKind === "image") {
      if (isHeicType(mime, ext)) {
        import("heic2any")
          .then((module) =>
            module.default({ blob: file, toType: "image/jpeg" }),
          )
          .then((result) => {
            const blob = Array.isArray(result) ? result[0] : result;
            const url = URL.createObjectURL(blob);
            if (previewIdRef.current !== previewId) {
              URL.revokeObjectURL(url);
              return;
            }
            previewUrlRef.current = url;
            applyPreview({ kind: "image", url });
          })
          .catch((err) => {
            console.error("Failed to preview HEIC image", err);
            applyError("Failed to preview HEIC image.");
          });
        return;
      }

      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      applyPreview({ kind: "image", url });
      return;
    }

    if (previewKind === "video") {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      applyPreview({ kind: "video", url });
      return;
    }

    applyPreview({ kind: "none" });
  }, [activeFile, readTextPreview, revokePreviewUrl]);

  return (
    <ToolPageWrapper
      toolId="file-type-detector"
      title="File Type Detector"
      description="Detect file types with file-type and preview printable formats."
      showHistory={false}
    >
      <FileTypeDetectorForm
        files={files}
        treeNodes={treeNodes}
        activeFileId={activeFileId}
        activeFile={activeFile}
        preview={preview}
        isLoading={isLoading}
        error={error}
        onFilesUpload={handleFilesUpload}
        onSelectFile={setActiveFileId}
        onClear={handleClear}
      />
    </ToolPageWrapper>
  );
}
