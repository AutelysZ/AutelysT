"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  Plus,
  X,
  Download,
  Copy,
  Check,
  FileCode,
  Upload,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import JSZip from "jszip";
import { cn } from "@/lib/utils";
import Editor, { type Monaco } from "@monaco-editor/react";
import { useTheme } from "next-themes";

type ProtoFile = {
  id: string;
  name: string;
  content: string;
};

type ProtoEditorProps = {
  files: ProtoFile[];
  onFilesChange: (files: ProtoFile[]) => void;
};

type PendingUpload = {
  newFiles: ProtoFile[];
  duplicates: string[];
};

const SAMPLE_PROTO = `syntax = "proto3";

message Person {
  string name = 1;
  int32 age = 2;
  string email = 3;
  repeated string tags = 4;
  Address address = 5;
}

message Address {
  string street = 1;
  string city = 2;
  string country = 3;
  string postal_code = 4;
}`;

// Protobuf language definition for Monaco
function registerProtobufLanguage(monaco: Monaco) {
  // Check if already registered
  const languages = monaco.languages.getLanguages();
  if (languages.some((lang) => lang.id === "protobuf")) {
    return;
  }

  // Register the language
  monaco.languages.register({ id: "protobuf", extensions: [".proto"] });

  // Define tokens for syntax highlighting
  monaco.languages.setMonarchTokensProvider("protobuf", {
    keywords: [
      "syntax",
      "import",
      "weak",
      "public",
      "package",
      "option",
      "message",
      "enum",
      "service",
      "rpc",
      "returns",
      "stream",
      "extend",
      "extensions",
      "to",
      "max",
      "reserved",
      "oneof",
      "map",
      "optional",
      "required",
      "repeated",
      "group",
    ],
    typeKeywords: [
      "double",
      "float",
      "int32",
      "int64",
      "uint32",
      "uint64",
      "sint32",
      "sint64",
      "fixed32",
      "fixed64",
      "sfixed32",
      "sfixed64",
      "bool",
      "string",
      "bytes",
    ],
    constants: ["true", "false"],

    operators: ["=", ";", "{", "}", "[", "]", "(", ")", "<", ">", ","],

    tokenizer: {
      root: [
        // Comments
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],

        // Strings
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [/'/, "string", "@stringSingle"],

        // Numbers
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, "number"],
        [/0[xX][0-9a-fA-F]+/, "number.hex"],

        // Keywords and identifiers
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@typeKeywords": "type",
              "@constants": "constant",
              "@default": "identifier",
            },
          },
        ],

        // Operators
        [/[=;{}[\](),<>]/, "delimiter"],
      ],

      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
      ],

      stringSingle: [
        [/[^\\']+/, "string"],
        [/\\./, "string.escape"],
        [/'/, "string", "@pop"],
      ],
    },
  });

  // Define language configuration for auto-closing brackets, etc.
  monaco.languages.setLanguageConfiguration("protobuf", {
    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
      ["<", ">"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "<", close: ">" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "<", close: ">" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern:
        /^\s*(message|enum|service|oneof|extend|rpc)\s+\w+\s*\{[^}]*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
  });

  // Register completion provider
  monaco.languages.registerCompletionItemProvider("protobuf", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        // Syntax
        {
          label: "syntax",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'syntax = "proto3";',
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Protocol buffer syntax version",
          range,
        },
        // Package
        {
          label: "package",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "package ${1:name};",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Package declaration",
          range,
        },
        // Import
        {
          label: "import",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'import "${1:path}";',
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Import another proto file",
          range,
        },
        // Message
        {
          label: "message",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "message ${1:Name} {\n  $0\n}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a message type",
          range,
        },
        // Enum
        {
          label: "enum",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "enum ${1:Name} {\n  ${2:UNKNOWN} = 0;\n  $0\n}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define an enumeration type",
          range,
        },
        // Service
        {
          label: "service",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "service ${1:Name} {\n  $0\n}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a service",
          range,
        },
        // RPC
        {
          label: "rpc",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText:
            "rpc ${1:MethodName}(${2:Request}) returns (${3:Response});",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define an RPC method",
          range,
        },
        // Oneof
        {
          label: "oneof",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "oneof ${1:name} {\n  $0\n}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a oneof field",
          range,
        },
        // Map
        {
          label: "map",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText:
            "map<${1:key_type}, ${2:value_type}> ${3:field_name} = ${4:number};",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a map field",
          range,
        },
        // Reserved
        {
          label: "reserved",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "reserved ${1:numbers};",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Reserve field numbers or names",
          range,
        },
        // Option
        {
          label: "option",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "option ${1:name} = ${2:value};",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Set an option",
          range,
        },
        // Field modifiers
        {
          label: "repeated",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "repeated ",
          documentation: "Field can be repeated (array)",
          range,
        },
        {
          label: "optional",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "optional ",
          documentation: "Field is optional",
          range,
        },
        // Scalar types
        ...[
          "double",
          "float",
          "int32",
          "int64",
          "uint32",
          "uint64",
          "sint32",
          "sint64",
          "fixed32",
          "fixed64",
          "sfixed32",
          "sfixed64",
          "bool",
          "string",
          "bytes",
        ].map((type) => ({
          label: type,
          kind: monaco.languages.CompletionItemKind.TypeParameter,
          insertText: `${type} \${1:field_name} = \${2:number};`,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: `${type} field type`,
          range,
        })),
      ];

      return { suggestions };
    },
  });
}

export function ProtoEditor({ files, onFilesChange }: ProtoEditorProps) {
  const [activeFileId, setActiveFileId] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const [editingFileId, setEditingFileId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [pendingUpload, setPendingUpload] =
    React.useState<PendingUpload | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const { resolvedTheme } = useTheme();

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  // Auto-select first file
  React.useEffect(() => {
    if (files.length > 0 && !activeFileId) {
      setActiveFileId(files[0].id);
    } else if (files.length === 0) {
      setActiveFileId("");
    } else if (activeFileId && !files.find((f) => f.id === activeFileId)) {
      setActiveFileId(files[0].id);
    }
  }, [files, activeFileId]);

  // Focus input when editing
  React.useEffect(() => {
    if (editingFileId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingFileId]);

  const handleEditorMount = React.useCallback((monaco: Monaco) => {
    registerProtobufLanguage(monaco);
  }, []);

  const handleFileContentChange = (content: string | undefined) => {
    if (!activeFile || content === undefined) return;
    const updatedFiles = files.map((file) =>
      file.id === activeFileId ? { ...file, content } : file,
    );
    onFilesChange(updatedFiles);
  };

  const handleAddNewFile = () => {
    const newFile: ProtoFile = {
      id: Date.now().toString(),
      name: `schema_${files.length + 1}.proto`,
      content: SAMPLE_PROTO,
    };
    onFilesChange([...files, newFile]);
    setActiveFileId(newFile.id);
  };

  const handleRemoveFile = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    const updatedFiles = files.filter((f) => f.id !== fileId);
    onFilesChange(updatedFiles);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    // Filter only .proto files and get relative paths for directories
    const protoFiles = Array.from(uploadedFiles).filter((file) =>
      file.name.endsWith(".proto"),
    );

    if (protoFiles.length === 0) {
      event.target.value = "";
      return;
    }

    const fileReaders = protoFiles.map((file) => {
      return new Promise<ProtoFile>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          // Use webkitRelativePath for directory uploads, otherwise just the filename
          const relativePath = (file as File & { webkitRelativePath?: string })
            .webkitRelativePath;
          let fileName = file.name;
          if (relativePath && relativePath.includes("/")) {
            // Remove the top-level directory name from the path
            const parts = relativePath.split("/");
            if (parts.length > 1) {
              fileName = parts.slice(1).join("/");
            }
          }
          resolve({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: fileName,
            content,
          });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    });

    Promise.all(fileReaders)
      .then((newFiles) => {
        // Check for duplicates
        const existingNames = new Set(files.map((f) => f.name));
        const duplicates = newFiles
          .filter((f) => existingNames.has(f.name))
          .map((f) => f.name);

        if (duplicates.length > 0) {
          // Show confirmation dialog
          setPendingUpload({ newFiles, duplicates });
        } else {
          // No duplicates, add directly
          onFilesChange([...files, ...newFiles]);
          if (newFiles.length > 0) {
            setActiveFileId(newFiles[0].id);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to read uploaded files:", error);
      });

    event.target.value = "";
  };

  const handleConfirmOverwrite = () => {
    if (!pendingUpload) return;

    const { newFiles } = pendingUpload;
    const newFileNames = new Set(newFiles.map((f) => f.name));

    // Remove duplicates from existing files, then add new files
    const filteredFiles = files.filter((f) => !newFileNames.has(f.name));
    onFilesChange([...filteredFiles, ...newFiles]);

    if (newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    }

    setPendingUpload(null);
  };

  const handleCancelOverwrite = () => {
    if (!pendingUpload) return;

    const { newFiles, duplicates } = pendingUpload;
    const duplicateSet = new Set(duplicates);

    // Only add non-duplicate files
    const nonDuplicates = newFiles.filter((f) => !duplicateSet.has(f.name));

    if (nonDuplicates.length > 0) {
      onFilesChange([...files, ...nonDuplicates]);
      setActiveFileId(nonDuplicates[0].id);
    }

    setPendingUpload(null);
  };

  const handleDownloadFiles = async () => {
    if (files.length === 0) return;

    if (files.length === 1) {
      // Single file: download directly
      const blob = new Blob([files[0].content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = files[0].name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } else {
      // Multiple files: download as zip
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.name, file.content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "proto-schemas.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  };

  const handleCopyContent = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleStartRename = (fileId: string, currentName: string) => {
    setEditingFileId(fileId);
    // Remove .proto suffix for editing
    const nameWithoutExt = currentName.endsWith(".proto")
      ? currentName.slice(0, -6)
      : currentName;
    setEditingName(nameWithoutExt);
  };

  const handleFinishRename = () => {
    if (!editingFileId || !editingName.trim()) {
      setEditingFileId(null);
      return;
    }
    const finalName = editingName.trim().endsWith(".proto")
      ? editingName.trim()
      : `${editingName.trim()}.proto`;
    const updatedFiles = files.map((file) =>
      file.id === editingFileId ? { ...file, name: finalName } : file,
    );
    onFilesChange(updatedFiles);
    setEditingFileId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishRename();
    } else if (e.key === "Escape") {
      setEditingFileId(null);
    }
  };

  // Empty state
  if (files.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-6">
          <FileCode className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            No .proto files. Upload files, folders, or create a new file.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".proto"
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is not in the type definitions
              webkitdirectory=""
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 gap-1.5 text-xs"
            >
              <Upload className="h-3 w-3" />
              Files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              className="h-7 gap-1.5 text-xs"
            >
              <FolderOpen className="h-3 w-3" />
              Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNewFile}
              className="h-7 gap-1.5 text-xs"
            >
              <Plus className="h-3 w-3" />
              New
            </Button>
          </div>
        </div>

        <AlertDialog
          open={!!pendingUpload}
          onOpenChange={(open) => !open && setPendingUpload(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Overwrite existing files?</AlertDialogTitle>
              <AlertDialogDescription>
                The following files already exist and will be overwritten:
                <ul className="mt-2 list-inside list-disc text-sm">
                  {pendingUpload?.duplicates.map((name) => (
                    <li key={name} className="font-mono">
                      {name}
                    </li>
                  ))}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelOverwrite}>
                Skip duplicates
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmOverwrite}>
                Overwrite
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-0 border-b">
        {/* File tabs */}
        <div className="flex flex-1 flex-wrap items-center gap-0">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "group relative flex h-8 shrink-0 items-center border-b-2 px-3 text-xs transition-colors",
                activeFileId === file.id
                  ? "border-primary bg-background text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {editingFileId === file.id ? (
                <Input
                  ref={renameInputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={handleRenameKeyDown}
                  className="h-5 w-24 px-1 text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveFileId(file.id)}
                  onDoubleClick={() => handleStartRename(file.id, file.name)}
                  className="max-w-[100px] truncate"
                  title={`${file.name} (double-click to rename)`}
                >
                  {file.name}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleRemoveFile(e, file.id)}
                className="ml-1.5 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {/* New file button */}
          <button
            type="button"
            onClick={handleAddNewFile}
            className="flex h-8 shrink-0 items-center px-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            title="New file"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 border-l px-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".proto"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is not in the type definitions
            webkitdirectory=""
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 w-7 p-0"
            title="Upload .proto files"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => folderInputRef.current?.click()}
            className="h-7 w-7 p-0"
            title="Upload folder with .proto files"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyContent}
            disabled={!activeFile}
            className="h-7 w-7 p-0"
            title="Copy content"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadFiles}
            disabled={files.length === 0}
            className="h-7 w-7 p-0"
            title={files.length > 1 ? "Download all as zip" : "Download file"}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      {activeFile && (
        <div className="border-b">
          <Editor
            height="600px"
            language="protobuf"
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            value={activeFile.content}
            onChange={handleFileContentChange}
            beforeMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
              automaticLayout: true,
              folding: true,
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: "always",
              autoClosingQuotes: "always",
              formatOnPaste: true,
              formatOnType: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              padding: { top: 8, bottom: 8 },
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>
      )}

      <AlertDialog
        open={!!pendingUpload}
        onOpenChange={(open) => !open && setPendingUpload(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite existing files?</AlertDialogTitle>
            <AlertDialogDescription>
              The following files already exist and will be overwritten:
              <ul className="mt-2 list-inside list-disc text-sm">
                {pendingUpload?.duplicates.map((name) => (
                  <li key={name} className="font-mono">
                    {name}
                  </li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelOverwrite}>
              Skip duplicates
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
