"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FolderOpen, Plus, X, Download, Copy, Check, FileCode } from "lucide-react"
import JSZip from "jszip"
import { cn } from "@/lib/utils"

type ProtoFile = {
  id: string
  name: string
  content: string
}

type ProtoEditorProps = {
  files: ProtoFile[]
  onFilesChange: (files: ProtoFile[]) => void
}

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
}`

export function ProtoEditor({ files, onFilesChange }: ProtoEditorProps) {
  const [activeFileId, setActiveFileId] = React.useState<string>("")
  const [copied, setCopied] = React.useState(false)
  const [editingFileId, setEditingFileId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  const activeFile = files.find((f) => f.id === activeFileId) || files[0]

  // Auto-select first file
  React.useEffect(() => {
    if (files.length > 0 && !activeFileId) {
      setActiveFileId(files[0].id)
    } else if (files.length === 0) {
      setActiveFileId("")
    } else if (activeFileId && !files.find((f) => f.id === activeFileId)) {
      setActiveFileId(files[0].id)
    }
  }, [files, activeFileId])

  // Focus input when editing
  React.useEffect(() => {
    if (editingFileId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingFileId])

  const handleFileContentChange = (content: string) => {
    if (!activeFile) return
    const updatedFiles = files.map((file) =>
      file.id === activeFileId ? { ...file, content } : file
    )
    onFilesChange(updatedFiles)
  }

  const handleAddNewFile = () => {
    const newFile: ProtoFile = {
      id: Date.now().toString(),
      name: `schema_${files.length + 1}.proto`,
      content: SAMPLE_PROTO,
    }
    onFilesChange([...files, newFile])
    setActiveFileId(newFile.id)
  }

  const handleRemoveFile = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation()
    const updatedFiles = files.filter((f) => f.id !== fileId)
    onFilesChange(updatedFiles)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files
    if (!uploadedFiles || uploadedFiles.length === 0) return

    const fileReaders = Array.from(uploadedFiles).map((file) => {
      return new Promise<ProtoFile>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          resolve({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: file.name,
            content,
          })
        }
        reader.onerror = reject
        reader.readAsText(file)
      })
    })

    Promise.all(fileReaders)
      .then((newFiles) => {
        onFilesChange([...files, ...newFiles])
        if (newFiles.length > 0) {
          setActiveFileId(newFiles[0].id)
        }
      })
      .catch((error) => {
        console.error("Failed to read uploaded files:", error)
      })

    event.target.value = ""
  }

  const handleDownloadFiles = async () => {
    if (files.length === 0) return

    if (files.length === 1) {
      // Single file: download directly
      const blob = new Blob([files[0].content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = files[0].name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } else {
      // Multiple files: download as zip
      const zip = new JSZip()
      for (const file of files) {
        zip.file(file.name, file.content)
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "proto-schemas.zip"
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }

  const handleCopyContent = async () => {
    if (!activeFile) return
    await navigator.clipboard.writeText(activeFile.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleStartRename = (fileId: string, currentName: string) => {
    setEditingFileId(fileId)
    // Remove .proto suffix for editing
    const nameWithoutExt = currentName.endsWith(".proto")
      ? currentName.slice(0, -6)
      : currentName
    setEditingName(nameWithoutExt)
  }

  const handleFinishRename = () => {
    if (!editingFileId || !editingName.trim()) {
      setEditingFileId(null)
      return
    }
    const finalName = editingName.trim().endsWith(".proto")
      ? editingName.trim()
      : `${editingName.trim()}.proto`
    const updatedFiles = files.map((file) =>
      file.id === editingFileId ? { ...file, name: finalName } : file
    )
    onFilesChange(updatedFiles)
    setEditingFileId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishRename()
    } else if (e.key === "Escape") {
      setEditingFileId(null)
    }
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-6">
        <FileCode className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          No .proto files. Upload or create a new file.
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 gap-1.5 text-xs"
          >
            <FolderOpen className="h-3 w-3" />
            Upload
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
    )
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
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 w-7 p-0"
            title="Upload .proto file"
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
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
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

      {/* Editor */}
      {activeFile && (
        <Textarea
          value={activeFile.content}
          onChange={(e) => handleFileContentChange(e.target.value)}
          placeholder="Enter your .proto schema here..."
          className="min-h-[180px] rounded-none border-0 border-b font-mono text-sm focus-visible:ring-0"
          spellCheck={false}
        />
      )}
    </div>
  )
}
