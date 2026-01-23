"use client"

import * as React from "react"
import { Suspense, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  AlertCircle,
  Upload,
  Download,
  FolderPlus,
  Trash2,
  FileArchive,
  CheckSquare,
  Square,
  Loader2,
  FolderOpen,
  Lock,
  Search,
  ChevronsUpDown,
  Check,
} from "lucide-react"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  type FileNode,
  type CompressionFormat,
  COMPRESSION_FORMATS,
  UNSUPPORTED_FORMATS,
  ALL_FORMATS,
  generateId,
  compressFiles,
  decompressFile,
  downloadFile,
  getExtensionForFormat,
  formatFileSize,
  calculateTotalSize,
  flattenFileTree,
} from "@/lib/archiver/codec"
import { FileTree, toggleAllSelection, countSelectedFiles, countTotalFiles } from "./file-tree"

// ============================================================================
// Searchable Format Selector Component
// ============================================================================

function FormatSelector({
  value,
  onChange,
  mode = "compress",
  placeholder = "Select format...",
}: {
  value: string
  onChange: (value: string) => void
  mode?: "compress" | "decompress"
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selectedFormat = COMPRESSION_FORMATS.find((f) => f.id === value)

  // Group formats by capability
  const compressionFormats = COMPRESSION_FORMATS.filter((f) => f.supportsCompression)
  const decompressionOnlyFormats = COMPRESSION_FORMATS.filter(
    (f) => f.supportsDecompression && !f.supportsCompression
  )

  const isSelectable = (f: CompressionFormat) => {
    if (mode === "compress") return f.supportsCompression
    return f.supportsCompression // For download, need compression support
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedFormat ? (
            <span className="flex items-center gap-2">
              {selectedFormat.name}
              {!selectedFormat.supportsMultipleFiles && (
                <span className="text-xs text-muted-foreground">(single file)</span>
              )}
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search formats (e.g., zip, zstd, 7z, rar)..." />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No format found.</CommandEmpty>

            {/* Compression-capable formats */}
            <CommandGroup heading="Compression Supported">
              {compressionFormats.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.name} ${f.id} ${f.extensions.join(" ")} ${f.description}`}
                  onSelect={() => {
                    onChange(f.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      value === f.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      {!f.supportsMultipleFiles && (
                        <span className="text-xs text-orange-600">(single)</span>
                      )}
                      {f.supportsPassword && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {f.extensions.join(", ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Decompression-only formats */}
            <CommandGroup heading="Extract Only (cannot compress)">
              {decompressionOnlyFormats.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.name} ${f.id} ${f.extensions.join(" ")} ${f.description}`}
                  disabled={!isSelectable(f)}
                  className={cn(!isSelectable(f) && "opacity-50")}
                  onSelect={() => {
                    if (isSelectable(f)) {
                      onChange(f.id)
                      setOpen(false)
                    }
                  }}
                >
                  <div className="mr-2 w-4" />
                  <div className="flex flex-col min-w-0">
                    <span className="flex items-center gap-2">
                      <span>{f.name}</span>
                      {!f.supportsMultipleFiles && (
                        <span className="text-xs text-orange-600">(single)</span>
                      )}
                      {f.supportsPassword && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {f.extensions.join(", ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Unsupported formats */}
            <CommandGroup heading="Not Supported in Browser">
              {UNSUPPORTED_FORMATS.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.name} ${f.id} ${f.extensions.join(" ")} ${f.description}`}
                  disabled
                  className="opacity-40"
                >
                  <div className="mr-2 w-4" />
                  <div className="flex flex-col min-w-0">
                    <span>{f.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {f.extensions.join(", ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ArchiverPage() {
  return (
    <Suspense fallback={null}>
      <ArchiverContent />
    </Suspense>
  )
}

function ArchiverContent() {
  return (
    <ToolPageWrapper
      toolId="archiver"
      title="Archiver"
      description="Compress and decompress files in various archive formats."
      showHistory={false}
    >
      <ArchiverInner />
    </ToolPageWrapper>
  )
}

// ============================================================================
// Inner Component
// ============================================================================

function ArchiverInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Helper to update URL params
  const updateUrlParam = useCallback((key: string, value: string, defaultValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === defaultValue) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }, [searchParams, router, pathname])

  // Sync mode with URL
  const mode: "compress" | "decompress" = searchParams.get("mode") === "decompress" ? "decompress" : "compress"
  const setMode = useCallback((newMode: "compress" | "decompress") => {
    updateUrlParam("mode", newMode, "compress")
  }, [updateUrlParam])

  // Sync format with URL
  const format = searchParams.get("format") || "zip"
  const setFormat = useCallback((newFormat: string) => {
    updateUrlParam("format", newFormat, "zip")
  }, [updateUrlParam])

  // Sync compression level with URL
  const compressionLevel = parseInt(searchParams.get("level") || "6", 10)
  const setCompressionLevel = useCallback((newLevel: number) => {
    updateUrlParam("level", newLevel.toString(), "6")
  }, [updateUrlParam])

  // Sync archive name with URL
  const archiveName = searchParams.get("name") || "archive"
  const setArchiveName = useCallback((newName: string) => {
    updateUrlParam("name", newName, "archive")
  }, [updateUrlParam])

  // Sync download format with URL (for decompress mode)
  const downloadFormat = searchParams.get("dlFormat") || "zip"
  const setDownloadFormat = useCallback((newFormat: string) => {
    updateUrlParam("dlFormat", newFormat, "zip")
  }, [updateUrlParam])

  const [filesToCompress, setCompressFiles] = React.useState<FileNode[]>([])
  const [extractedFiles, setExtractedFiles] = React.useState<FileNode[]>([])
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [detectedFormat, setDetectedFormat] = React.useState<string | null>(null)

  // Dialog state
  const [showNewFolderDialog, setShowNewFolderDialog] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [newFolderPath, setNewFolderPath] = React.useState("")
  const [showPasswordDialog, setShowPasswordDialog] = React.useState(false)
  const [pendingDecompressData, setPendingDecompressData] = React.useState<{
    data: Uint8Array
    filename: string
  } | null>(null)

  // Refs
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)
  const archiveInputRef = React.useRef<HTMLInputElement>(null)

  // Get available formats for compression
  const compressionFormats = COMPRESSION_FORMATS.filter((f) => f.supportsCompression)
  const decompressionFormats = COMPRESSION_FORMATS.filter((f) => f.supportsDecompression)
  const selectedFormat = COMPRESSION_FORMATS.find((f) => f.id === format)

  // Stats for compress mode
  const compressTotalFiles = countTotalFiles(filesToCompress)
  const compressSelectedFiles = countSelectedFiles(filesToCompress)
  const compressTotalSize = calculateTotalSize(filesToCompress)

  // Stats for decompress mode
  const extractTotalFiles = countTotalFiles(extractedFiles)
  const extractSelectedFiles = countSelectedFiles(extractedFiles)
  const extractTotalSize = calculateTotalSize(extractedFiles)

  // Handle file upload for compression
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files
    if (!uploadedFiles || uploadedFiles.length === 0) return

    const newFiles: FileNode[] = []

    const readFile = (file: File, relativePath: string): Promise<FileNode> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          resolve({
            id: generateId(),
            name: file.name,
            type: "file",
            path: relativePath,
            size: file.size,
            data,
            selected: true,
          })
        }
        reader.readAsArrayBuffer(file)
      })
    }

    const processFiles = async () => {
      for (const file of Array.from(uploadedFiles)) {
        const relativePath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
        const fileNode = await readFile(file, relativePath)
        newFiles.push(fileNode)
      }

      // Build tree structure for directory uploads
      if (newFiles.length > 0) {
        const hasDirectories = newFiles.some((f) => f.path.includes("/"))
        if (hasDirectories) {
          setCompressFiles((prev) => [...prev, ...buildTreeFromPaths(newFiles)])
        } else {
          setCompressFiles((prev) => [...prev, ...newFiles])
        }
      }
    }

    processFiles()
    event.target.value = ""
  }

  // Build tree from flat paths
  const buildTreeFromPaths = (flatFiles: FileNode[]): FileNode[] => {
    const root: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

    for (const file of flatFiles) {
      const parts = file.path.split("/").filter(Boolean)
      let currentPath = ""
      let currentLevel = root

      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (currentPath ? "/" : "") + parts[i]

        let dir = pathMap.get(currentPath)
        if (!dir) {
          dir = {
            id: generateId(),
            name: parts[i],
            type: "directory",
            path: currentPath,
            children: [],
            selected: true,
            expanded: true,
          }
          pathMap.set(currentPath, dir)
          currentLevel.push(dir)
        }
        currentLevel = dir.children!
      }

      currentLevel.push(file)
    }

    return root
  }

  // Handle archive upload for decompression (supports multiple files)
  const handleArchiveUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files
    if (!uploadedFiles || uploadedFiles.length === 0) {
      console.log("No files selected")
      return
    }

    console.log(`Selected ${uploadedFiles.length} file(s) for decompression`)

    setIsProcessing(true)
    setError(null)
    setExtractedFiles([]) // Clear previous files

    const allExtractedFiles: FileNode[] = []
    const detectedFormats: string[] = []

    try {
      for (const file of Array.from(uploadedFiles)) {
        console.log(`Processing archive: ${file.name}, size: ${file.size}`)
        const data = new Uint8Array(await file.arrayBuffer())
        console.log(`Read ${data.length} bytes from ${file.name}`)

        try {
          const result = await decompressFile(data, file.name, password || undefined)
          console.log(`Decompressed ${file.name}: ${result.files.length} files, format: ${result.format}`)

          // If multiple archives, prefix paths with archive name
          if (uploadedFiles.length > 1) {
            const baseName = file.name.replace(/\.[^.]+$/, "")
            const prefixedFiles = prefixFilePaths(result.files, baseName)
            allExtractedFiles.push(...prefixedFiles)
          } else {
            allExtractedFiles.push(...result.files)
          }

          if (!detectedFormats.includes(result.format)) {
            detectedFormats.push(result.format)
          }
        } catch (err) {
          console.error(`Error decompressing ${file.name}:`, err)
          if (
            err instanceof Error &&
            (err.message.includes("password") || err.message.includes("encrypted"))
          ) {
            // Show password dialog for first encrypted archive
            setPendingDecompressData({ data, filename: file.name })
            setShowPasswordDialog(true)
            event.target.value = ""
            return
          } else {
            throw new Error(`Failed to extract ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`)
          }
        }
      }

      console.log(`Total extracted files: ${allExtractedFiles.length}`, allExtractedFiles)
      setExtractedFiles(allExtractedFiles)
      setDetectedFormat(detectedFormats.join(", "))
    } catch (err) {
      console.error("Decompression error:", err)
      setError(err instanceof Error ? err.message : "Failed to decompress files")
    } finally {
      setIsProcessing(false)
      event.target.value = ""
    }
  }

  // Helper to prefix file paths when extracting multiple archives
  const prefixFilePaths = (nodes: FileNode[], prefix: string): FileNode[] => {
    return nodes.map((node) => ({
      ...node,
      path: `${prefix}/${node.path}`,
      children: node.children ? prefixFilePaths(node.children, prefix) : undefined,
    }))
  }

  // Handle password submit for encrypted archives
  const handlePasswordSubmit = async () => {
    if (!pendingDecompressData) return

    setShowPasswordDialog(false)
    setIsProcessing(true)
    setError(null)

    try {
      const result = await decompressFile(
        pendingDecompressData.data,
        pendingDecompressData.filename,
        password
      )
      setExtractedFiles(result.files)
      setDetectedFormat(result.format)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decompress file")
    } finally {
      setIsProcessing(false)
      setPendingDecompressData(null)
    }
  }

  // Compress and download
  const handleCompress = async () => {
    if (filesToCompress.length === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      const compressed = await compressFiles(filesToCompress, {
        format,
        password: password || undefined,
        level: compressionLevel,
      })

      const extension = getExtensionForFormat(format)

      // For single-file formats, use original filename + extension
      let downloadName = `${archiveName}${extension}`
      if (selectedFormat && !selectedFormat.supportsMultipleFiles) {
        const selectedFilesList = flattenFileTree(filesToCompress, true)
        if (selectedFilesList.length === 1) {
          downloadName = `${selectedFilesList[0].name}${extension}`
        }
      }

      downloadFile(compressed, downloadName)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compress files")
    } finally {
      setIsProcessing(false)
    }
  }

  // Download all selected files in chosen format (for decompress mode)
  const handleDownloadAll = async () => {
    if (extractedFiles.length === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      const compressed = await compressFiles(extractedFiles, {
        format: downloadFormat,
        password: password || undefined,
        level: compressionLevel,
      })

      const extension = getExtensionForFormat(downloadFormat)
      const downloadFormatObj = COMPRESSION_FORMATS.find((f) => f.id === downloadFormat)

      // For single-file formats, use original filename + extension
      let downloadName = `${archiveName || "archive"}${extension}`
      if (downloadFormatObj && !downloadFormatObj.supportsMultipleFiles) {
        const selectedFilesList = flattenFileTree(extractedFiles, true)
        if (selectedFilesList.length === 1) {
          downloadName = `${selectedFilesList[0].name}${extension}`
        }
      }

      downloadFile(compressed, downloadName)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to create archive")
    } finally {
      setIsProcessing(false)
    }
  }

  // Create new folder
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return

    const folderPath = newFolderPath
      ? `${newFolderPath}/${newFolderName}`
      : newFolderName

    const newFolder: FileNode = {
      id: generateId(),
      name: newFolderName,
      type: "directory",
      path: folderPath,
      children: [],
      selected: true,
      expanded: true,
    }

    if (newFolderPath) {
      // Add to existing folder
      const addToPath = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === newFolderPath && node.type === "directory") {
            return {
              ...node,
              children: [...(node.children || []), newFolder],
            }
          }
          if (node.children) {
            return { ...node, children: addToPath(node.children) }
          }
          return node
        })
      }
      setCompressFiles(addToPath(filesToCompress))
    } else {
      // Add to root
      setCompressFiles([...filesToCompress, newFolder])
    }

    setShowNewFolderDialog(false)
    setNewFolderName("")
    setNewFolderPath("")
  }

  // Select/deselect all for compress mode
  const handleCompressSelectAll = (selected: boolean) => {
    setCompressFiles(toggleAllSelection(filesToCompress, selected))
  }

  // Select/deselect all for decompress mode
  const handleExtractSelectAll = (selected: boolean) => {
    setExtractedFiles(toggleAllSelection(extractedFiles, selected))
  }

  // Clear all for compress mode
  const handleCompressClearAll = () => {
    setCompressFiles([])
    setError(null)
  }

  // Clear all for decompress mode
  const handleExtractClearAll = () => {
    setExtractedFiles([])
    setError(null)
    setDetectedFormat(null)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Mode selector */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "compress" | "decompress")}>
        <TabsList>
          <TabsTrigger value="compress" className="px-6">
            <FileArchive className="h-4 w-4 mr-2" />
            Compress
          </TabsTrigger>
          <TabsTrigger value="decompress" className="px-6">
            <FolderOpen className="h-4 w-4 mr-2" />
            Decompress
          </TabsTrigger>
        </TabsList>

        {/* Compress Tab */}
        <TabsContent value="compress" className="mt-4 space-y-4">
          {/* Upload and actions */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
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
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Add Files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              className="gap-1.5"
            >
              <FolderOpen className="h-4 w-4" />
              Add Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewFolderPath("")
                setShowNewFolderDialog(true)
              }}
              className="gap-1.5"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCompressSelectAll(true)}
              className="gap-1.5"
            >
              <CheckSquare className="h-4 w-4" />
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCompressSelectAll(false)}
              className="gap-1.5"
            >
              <Square className="h-4 w-4" />
              Deselect All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCompressClearAll}
              className="gap-1.5 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>

          {/* File tree */}
          <Card>
            <CardHeader className="py-2 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Files ({compressSelectedFiles}/{compressTotalFiles} selected)
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(compressTotalSize)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-auto border-t">
              <FileTree
                nodes={filesToCompress}
                onNodesChange={setCompressFiles}
                showDelete
                draggable
              />
            </CardContent>
          </Card>

          {/* Compression options */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm">Archive Name</Label>
              <Input
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                placeholder="archive"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Format (searchable)</Label>
              <FormatSelector
                value={format}
                onChange={setFormat}
                mode="compress"
                placeholder="Select format..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Compression Level</Label>
              <Select
                value={compressionLevel.toString()}
                onValueChange={(v) => setCompressionLevel(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Store (no compression)</SelectItem>
                  <SelectItem value="1">Fastest</SelectItem>
                  <SelectItem value="5">Normal</SelectItem>
                  <SelectItem value="6">Default</SelectItem>
                  <SelectItem value="9">Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">
                Password {!selectedFormat?.supportsPassword && "(not supported)"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Optional"
                  className="pl-8"
                  disabled={!selectedFormat?.supportsPassword}
                />
              </div>
            </div>
          </div>

          {/* Format warnings */}
          {selectedFormat && !selectedFormat.supportsMultipleFiles && compressSelectedFiles > 1 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedFormat.name} format only supports single file compression.
                Only the first file will be compressed.
              </AlertDescription>
            </Alert>
          )}

          {/* Compress button */}
          <Button
            onClick={handleCompress}
            disabled={isProcessing || filesToCompress.length === 0 || compressSelectedFiles === 0}
            className="w-full gap-2"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Compress & Download
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Decompress Tab */}
        <TabsContent value="decompress" className="mt-4 space-y-4">
          {/* Upload */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={archiveInputRef}
              type="file"
              multiple
              onChange={handleArchiveUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Open Archive(s)
            </Button>
            {detectedFormat && (
              <span className="text-sm text-muted-foreground">
                Format: <span className="font-medium">{detectedFormat.toUpperCase()}</span>
              </span>
            )}
            <div className="flex-1" />
            {extractedFiles.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExtractSelectAll(true)}
                  className="gap-1.5"
                >
                  <CheckSquare className="h-4 w-4" />
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExtractSelectAll(false)}
                  className="gap-1.5"
                >
                  <Square className="h-4 w-4" />
                  Deselect All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExtractClearAll}
                  className="gap-1.5 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </>
            )}
          </div>

          {/* File tree */}
          {extractedFiles.length > 0 ? (
            <Card>
              <CardHeader className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Extracted Files ({extractSelectedFiles}/{extractTotalFiles} selected)
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(extractTotalSize)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-auto border-t">
                <FileTree
                  nodes={extractedFiles}
                  onNodesChange={setExtractedFiles}
                  showDownload
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <FileArchive className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Upload an archive file to extract its contents
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats:{" "}
                  {decompressionFormats.map((f) => f.extensions[0]).join(", ")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Download options */}
          {extractedFiles.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-2">
                <Label className="text-sm">Archive Name</Label>
                <Input
                  value={archiveName}
                  onChange={(e) => setArchiveName(e.target.value)}
                  placeholder="archive"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Download Format</Label>
                <FormatSelector
                  value={downloadFormat}
                  onChange={setDownloadFormat}
                  mode="decompress"
                  placeholder="Select format..."
                />
              </div>
              <Button
                onClick={handleDownloadAll}
                disabled={isProcessing || extractSelectedFiles === 0}
                className="gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download Selected
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Supported formats info */}
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium">Supported Formats</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                {decompressionFormats.map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground">{f.extensions.join(", ")}</span>
                  </div>
                ))}
              </div>
              {UNSUPPORTED_FORMATS.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Not supported in browser:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {UNSUPPORTED_FORMATS.map((f) => (
                      <span
                        key={f.id}
                        className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground"
                      >
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder.
              {newFolderPath && ` It will be created inside "${newFolderPath}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New Folder"
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Path (optional)</Label>
              <Input
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                placeholder="path/to/parent"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Required</DialogTitle>
            <DialogDescription>
              This archive is password protected. Please enter the password to extract.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false)
                setPendingDecompressData(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit}>Extract</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
