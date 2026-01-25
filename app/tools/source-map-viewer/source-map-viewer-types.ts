import type { RawSourceMap as SourceMapRaw } from "source-map-js"

export type RawSourceMap = SourceMapRaw & {
  sourcesContent?: Array<string | null>
}

export type SourceFile = {
  id: string
  path: string
  content: string | null
}

export type SourceMapBundle = {
  id: string
  name: string
  sourceRoot?: string
  sources: SourceFile[]
}

export type SourceTreeNode = {
  id: string
  name: string
  path: string
  type: "directory" | "file"
  children?: SourceTreeNode[]
  fileId?: string
  mapId?: string
}
