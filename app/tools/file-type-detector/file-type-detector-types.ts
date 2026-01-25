export type DetectedFileType = {
  ext: string
  mime: string
} | null

export type PreviewState =
  | { kind: "none" }
  | { kind: "text"; content: string; truncated: boolean }
  | { kind: "image"; url: string }
  | { kind: "video"; url: string }
  | { kind: "pdf"; url: string }

export type FileRecord = {
  id: string
  file: File
  name: string
  path: string
  size: number
  lastModified: number
  detectedType: DetectedFileType
}

export type FileTreeNode = {
  id: string
  name: string
  path: string
  type: "directory" | "file"
  children?: FileTreeNode[]
  fileId?: string
}
