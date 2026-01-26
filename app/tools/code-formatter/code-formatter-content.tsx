"use client";

import * as React from "react";
import prettier from "prettier/standalone";
import type { Plugin } from "prettier";
import { getProcessor, LangVariant } from "sh-syntax";
import prettierPluginAngular from "prettier/plugins/angular";
import prettierPluginBabel from "prettier/plugins/babel";
import prettierPluginEstree from "prettier/plugins/estree";
import prettierPluginFlow from "prettier/plugins/flow";
import prettierPluginGlimmer from "prettier/plugins/glimmer";
import prettierPluginGraphql from "prettier/plugins/graphql";
import prettierPluginHtml from "prettier/plugins/html";
import prettierPluginMarkdown from "prettier/plugins/markdown";
import prettierPluginMeriyah from "prettier/plugins/meriyah";
import prettierPluginPostcss from "prettier/plugins/postcss";
import prettierPluginTypescript from "prettier/plugins/typescript";
import prettierPluginYaml from "prettier/plugins/yaml";
import * as prettierPluginPug from "@prettier/plugin-pug";
import prettierPluginXml from "@prettier/plugin-xml";
import prettierPluginJava from "prettier-plugin-java";
import * as prettierPluginBigcommerceStencil from "prettier-plugin-bigcommerce-stencil";
import prettierPluginGherkin from "prettier-plugin-gherkin";
import prettierPluginHugoPost from "prettier-plugin-hugo-post";
import prettierPluginJinjaTemplate from "prettier-plugin-jinja-template";
import prettierPluginNginx from "prettier-plugin-nginx";
import prettierPluginRust from "prettier-plugin-rust";
import prettierPluginSql from "prettier-plugin-sql";
import prettierPluginToml from "prettier-plugin-toml";
import prettierPluginXquery from "prettier-plugin-xquery";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import type { HistoryEntry } from "@/lib/history/db";
import CodeFormatterInner from "./code-formatter-inner";
import {
  buildFileTree,
  downloadFormatterFile,
  downloadFormatterZip,
  generateId,
  normalizeFilePath,
  parseFilesJson,
  serializeFiles,
} from "./code-formatter-utils";
import {
  paramsSchema,
  type FormatterFile,
  type ParamsState,
} from "./code-formatter-types";
import type { SourceTreeNode } from "../source-map-viewer/source-map-viewer-types";

const prettierPlugins: Plugin[] = [
  prettierPluginAngular as Plugin,
  prettierPluginBabel as Plugin,
  prettierPluginEstree as Plugin,
  prettierPluginFlow as Plugin,
  prettierPluginGlimmer as Plugin,
  prettierPluginGraphql as Plugin,
  prettierPluginHtml as Plugin,
  prettierPluginPug as Plugin,
  prettierPluginMarkdown as Plugin,
  prettierPluginMeriyah as Plugin,
  prettierPluginPostcss as Plugin,
  prettierPluginTypescript as Plugin,
  prettierPluginJava as Plugin,
  prettierPluginXml as Plugin,
  prettierPluginBigcommerceStencil as Plugin,
  prettierPluginGherkin as Plugin,
  prettierPluginHugoPost as Plugin,
  prettierPluginJinjaTemplate as Plugin,
  prettierPluginNginx as Plugin,
  prettierPluginRust as Plugin,
  prettierPluginSql as Plugin,
  prettierPluginToml as Plugin,
  prettierPluginXquery as Plugin,
  prettierPluginYaml as Plugin,
];

const shellWasmUrl =
  "https://cdn.jsdelivr.net/npm/sh-syntax@0.5.8/main.wasm";
let shellProcessorPromise:
  | Promise<ReturnType<typeof getProcessor>>
  | null = null;

function getShellProcessor() {
  if (!shellProcessorPromise) {
    shellProcessorPromise = Promise.resolve(
      getProcessor(() => fetch(shellWasmUrl)),
    );
  }
  return shellProcessorPromise;
}

function isShellPath(path: string) {
  const lower = path.toLowerCase();
  return (
    lower.endsWith(".sh") ||
    lower.endsWith(".bash") ||
    lower.endsWith(".zsh") ||
    lower.endsWith(".ksh")
  );
}

async function formatShell(
  input: string,
  filepath: string,
  options: ParamsState,
) {
  const processor = await getShellProcessor();
  return processor(input, {
    filepath,
    print: true,
    variant: LangVariant.LangAuto,
    useTabs: options.useTabs,
    tabWidth: options.tabWidth,
  });
}

type FormatResult = { formatted: string | null; error: string | null };

const DEFAULT_FILE_PATH = "untitled.js";

async function formatWithPrettier(
  file: FormatterFile,
  options: ParamsState,
): Promise<FormatResult> {
  if (isShellPath(file.path)) {
    try {
      const formatted = await formatShell(
        file.content,
        file.path || "script.sh",
        options,
      );
      return { formatted, error: null };
    } catch (error) {
      console.error("Shell formatting failed", error);
      const message =
        error instanceof Error ? error.message : "Failed to format shell file.";
      return { formatted: null, error: message };
    }
  }
  try {
    const formatted = await prettier.format(file.content, {
      filepath: file.path,
      printWidth: options.printWidth,
      tabWidth: options.tabWidth,
      useTabs: options.useTabs,
      semi: options.semi,
      singleQuote: options.singleQuote,
      trailingComma: options.trailingComma,
      bracketSpacing: options.bracketSpacing,
      arrowParens: options.arrowParens,
      endOfLine: options.endOfLine,
      plugins: prettierPlugins,
    });
    return { formatted, error: null };
  } catch (error) {
    console.error("Formatting failed", error);
    const message =
      error instanceof Error ? error.message : "Failed to format file.";
    return { formatted: null, error: message };
  }
}

export default function CodeFormatterContent() {
  const [state, setState] = React.useState<ParamsState>(() =>
    paramsSchema.parse({}),
  );
  const setParam = React.useCallback(
    <K extends keyof ParamsState>(
      key: K,
      value: ParamsState[K],
      _updateHistory?: boolean,
    ) => {
      setState((prev) => {
        if (prev[key] === value) return prev;
        return { ...prev, [key]: value };
      });
    },
    [],
  );

  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [formatErrorsById, setFormatErrorsById] = React.useState<
    Record<string, string>
  >({});

  const { files, error: parseError } = React.useMemo(
    () => parseFilesJson(state.files),
    [state.files],
  );

  const treeNodes = React.useMemo(() => buildFileTree(files), [files]);

  const activeFile = React.useMemo(
    () => files.find((file) => file.id === state.activeFileId) ?? files[0] ?? null,
    [files, state.activeFileId],
  );

  const formatErrors = React.useMemo(() => {
    const entries = Object.entries(formatErrorsById);
    if (!entries.length) return [];
    return entries
      .filter(([, message]) =>
        !message.toLowerCase().includes("no parser could be inferred for file"),
      )
      .map(([fileId, message]) => {
        const file = files.find((item) => item.id === fileId);
        return file ? `${file.path}: ${message}` : message;
      });
  }, [files, formatErrorsById]);

  const activeFileError = React.useMemo(() => {
    if (!activeFile) return null;
    return formatErrorsById[activeFile.id] ?? null;
  }, [activeFile, formatErrorsById]);

  const updateFiles = React.useCallback(
    (nextFiles: FormatterFile[]) => {
      setParam("files", serializeFiles(nextFiles));
    },
    [setParam],
  );

  React.useEffect(() => {
    if (files.length === 0) {
      const newFile: FormatterFile = {
        id: generateId(),
        path: DEFAULT_FILE_PATH,
        content: "",
      };
      updateFiles([newFile]);
      setParam("activeFileId", newFile.id);
    }
  }, [files.length, setParam, updateFiles]);


  React.useEffect(() => {
    if (files.length === 0) return;
    if (!activeFile) {
      setParam("activeFileId", files[0].id);
    }
  }, [activeFile, files, setParam]);

  React.useEffect(() => {
    setFormatErrorsById((prev) => {
      const next: Record<string, string> = {};
      for (const file of files) {
        if (prev[file.id]) {
          next[file.id] = prev[file.id];
        }
      }
      return next;
    });
  }, [files]);

  const handleFilesUpload = React.useCallback(
    async (uploads: File[]) => {
      setDownloadError(null);
      const nextFiles = [...files];
      const indexByPath = new Map<string, number>();
      const updatedIds = new Set<string>();
      nextFiles.forEach((file, index) => {
        indexByPath.set(normalizeFilePath(file.path), index);
      });

      for (const file of uploads) {
        try {
          const content = await file.text();
          const rawPath =
            (file as File & { webkitRelativePath?: string })
              .webkitRelativePath || file.name;
          const path = normalizeFilePath(rawPath || "untitled");
          const existingIndex = indexByPath.get(path);
          if (existingIndex !== undefined) {
            nextFiles[existingIndex] = {
              ...nextFiles[existingIndex],
              content,
            };
            updatedIds.add(nextFiles[existingIndex].id);
          } else {
            const newFile: FormatterFile = {
              id: generateId(),
              path,
              content,
            };
            nextFiles.push(newFile);
            indexByPath.set(path, nextFiles.length - 1);
          }
        } catch (error) {
          console.error("Failed to read file", error);
        }
      }

      if (updatedIds.size > 0) {
        setFormatErrorsById((prev) => {
          const next = { ...prev };
          updatedIds.forEach((id) => {
            delete next[id];
          });
          return next;
        });
      }

      if (nextFiles.length) {
        updateFiles(nextFiles);
        if (!state.activeFileId) {
          setParam("activeFileId", nextFiles[0].id);
        }
      }
    },
    [files, setParam, state.activeFileId, updateFiles],
  );

  const handleCreateFile = React.useCallback(
    (path: string, content: string) => {
      if (!path.trim()) return;
      const normalized = normalizeFilePath(path.trim());
      const nextFiles = [...files];
      const existingIndex = nextFiles.findIndex(
        (file) => normalizeFilePath(file.path) === normalized,
      );
      if (existingIndex >= 0) {
        nextFiles[existingIndex] = {
          ...nextFiles[existingIndex],
          content,
        };
        setFormatErrorsById((prev) => {
          if (!prev[nextFiles[existingIndex].id]) return prev;
          const next = { ...prev };
          delete next[nextFiles[existingIndex].id];
          return next;
        });
      } else {
        const newFile: FormatterFile = {
          id: generateId(),
          path: normalized,
          content,
        };
        nextFiles.push(newFile);
        setParam("activeFileId", newFile.id);
      }
      updateFiles(nextFiles);
    },
    [files, setParam, updateFiles],
  );

  const handleSelectFile = React.useCallback(
    (fileId: string) => {
      setParam("activeFileId", fileId);
    },
    [setParam],
  );

  const handleEditorChange = React.useCallback(
    (value: string) => {
      if (!activeFile) return;
      const nextFiles = files.map((file) =>
        file.id === activeFile.id
          ? { ...file, content: value }
          : file,
      );
      setFormatErrorsById((prev) => {
        if (!prev[activeFile.id]) return prev;
        const next = { ...prev };
        delete next[activeFile.id];
        return next;
      });
      updateFiles(nextFiles);
    },
    [activeFile, files, updateFiles],
  );

  const handleDeleteNode = React.useCallback(
    (node: SourceTreeNode) => {
      if (node.type === "directory") {
        if (node.id === "root") return;
        const prefix = `${normalizeFilePath(node.path)}/`;
        const nextFiles = files.filter((file) => {
          const normalized = normalizeFilePath(file.path);
          return !(normalized === node.path || normalized.startsWith(prefix));
        });
        updateFiles(nextFiles);
        if (activeFile && !nextFiles.some((file) => file.id === activeFile.id)) {
          setParam("activeFileId", nextFiles[0]?.id ?? "");
        }
        return;
      }
      if (!node.fileId) return;
      const nextFiles = files.filter((file) => file.id !== node.fileId);
      updateFiles(nextFiles);
      if (activeFile?.id === node.fileId) {
        setParam("activeFileId", nextFiles[0]?.id ?? "");
      }
    },
    [activeFile, files, setParam, updateFiles],
  );

  const handleRenameActiveFile = React.useCallback(
    (nextPath: string) => {
      if (!activeFile) return;
      const normalized = normalizeFilePath(nextPath);
      const nextFiles = files.map((file) =>
        file.id === activeFile.id
          ? { ...file, path: normalized }
          : file,
      );
      updateFiles(nextFiles);
    },
    [activeFile, files, updateFiles],
  );

  const handleFormatActive = React.useCallback(async () => {
    if (!activeFile || isFormatting) return;
    setIsFormatting(true);
    const result = await formatWithPrettier(activeFile, state);
    const nextFiles = files.map((file) =>
      file.id === activeFile.id && result.formatted !== null
        ? { ...file, content: result.formatted }
        : file,
    );
    setFormatErrorsById((prev) => {
      const next = { ...prev };
      if (result.error) {
        next[activeFile.id] = result.error;
      } else {
        delete next[activeFile.id];
      }
      return next;
    });
    updateFiles(nextFiles);
    setIsFormatting(false);
  }, [activeFile, files, isFormatting, state, updateFiles]);

  const handleFormatAll = React.useCallback(async () => {
    if (!files.length || isFormatting) return;
    setIsFormatting(true);
    const nextFiles: FormatterFile[] = [];
    const nextErrors: Record<string, string> = {};
    for (const file of files) {
      const result = await formatWithPrettier(file, state);
      if (result.formatted !== null) {
        nextFiles.push({ ...file, content: result.formatted });
      } else {
        nextFiles.push(file);
      }
      if (result.error) {
        nextErrors[file.id] = result.error;
      }
    }
    setFormatErrorsById(nextErrors);
    updateFiles(nextFiles);
    setIsFormatting(false);
  }, [files, isFormatting, state, updateFiles]);

  const handleDownloadFile = React.useCallback(() => {
    if (!activeFile) return;
    downloadFormatterFile(activeFile.path, activeFile.content);
  }, [activeFile]);

  const handleDownloadAll = React.useCallback(async () => {
    setDownloadError(null);
    try {
      const result = await downloadFormatterZip(files, "formatted-files.zip");
      if (!result.ok) {
        setDownloadError(result.message);
      }
    } catch (error) {
      console.error("Failed to download zip", error);
      setDownloadError("Failed to build ZIP archive.");
    }
  }, [files]);

  const handleClear = React.useCallback(() => {
    setDownloadError(null);
    setFormatErrorsById({});
    setParam("files", "[]");
    setParam("activeFileId", "");
  }, [setParam]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.files !== undefined) {
        setParam("files", String(inputs.files));
      }
      if (params.activeFileId) {
        setParam("activeFileId", String(params.activeFileId));
      }
      if (params.printWidth !== undefined) {
        setParam("printWidth", Number(params.printWidth));
      }
      if (params.tabWidth !== undefined) {
        setParam("tabWidth", Number(params.tabWidth));
      }
      if (params.useTabs !== undefined) {
        setParam("useTabs", Boolean(params.useTabs));
      }
      if (params.semi !== undefined) {
        setParam("semi", Boolean(params.semi));
      }
      if (params.singleQuote !== undefined) {
        setParam("singleQuote", Boolean(params.singleQuote));
      }
      if (params.trailingComma) {
        setParam("trailingComma", String(params.trailingComma) as ParamsState["trailingComma"]);
      }
      if (params.bracketSpacing !== undefined) {
        setParam("bracketSpacing", Boolean(params.bracketSpacing));
      }
      if (params.arrowParens) {
        setParam("arrowParens", String(params.arrowParens) as ParamsState["arrowParens"]);
      }
      if (params.endOfLine) {
        setParam("endOfLine", String(params.endOfLine) as ParamsState["endOfLine"]);
      }
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="code-formatter"
      title="Code Formatter"
      description="Format multi-language code with Prettier, manage files in a tree, and edit in Monaco."
      onLoadHistory={handleLoadHistory}
      showHistory={false}
    >
      <CodeFormatterInner
        state={state}
        files={files}
        treeNodes={treeNodes}
        activeFile={activeFile}
        parseError={parseError}
        formatErrors={formatErrors}
        activeFileError={activeFileError}
        downloadError={downloadError}
        isFormatting={isFormatting}
        showFileTree
        onFilesUpload={handleFilesUpload}
        onCreateFile={handleCreateFile}
        onSelectFile={handleSelectFile}
        onEditorChange={handleEditorChange}
        onRenameActiveFile={handleRenameActiveFile}
        onDeleteNode={handleDeleteNode}
        onFormatActive={handleFormatActive}
        onFormatAll={handleFormatAll}
        onDownloadFile={handleDownloadFile}
        onDownloadAll={handleDownloadAll}
        onClear={handleClear}
        setParam={setParam}
      />
    </ToolPageWrapper>
  );
}
