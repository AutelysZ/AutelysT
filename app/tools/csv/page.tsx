"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import JSZip from "jszip"
import * as XLSX from "xlsx"
import { Upload, FolderOpen, Download, Plus, Trash2, AlertCircle, FileText, X } from "lucide-react"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CsvGrid } from "./csv-grid"
import { stringifyCsv, stripCsvExtension, isValidSheetName, rowsToWorksheet, readCsvFile, readExcelFile } from "@/lib/csv/utils"
import { clearCsvState, loadCsvState, saveCsvState } from "@/lib/csv/storage"
import type { CsvFileData } from "@/lib/csv/utils"
import { cn } from "@/lib/utils"

type CsvFileMeta = {
  id: string
  name: string
  freezeRows: number
  freezeCols: number
  columnWidth: number
  rowHeight: number
  columnWidthOverrides: Record<number, number>
  rowHeightOverrides: Record<number, number>
  rowCount: number
  columnCount: number
}

const paramsSchema = z.object({
  activeFileId: z.string().default(""),
  freezeRows: z.number().int().min(0).max(1000).default(0),
  freezeCols: z.number().int().min(0).max(1000).default(0),
  columnWidth: z.number().int().min(40).max(800).default(140),
  rowHeight: z.number().int().min(20).max(200).default(32),
})

export default function CsvToolPage() {
  return (
    <Suspense fallback={null}>
      <CsvToolWrapper />
    </Suspense>
  )
}

function CsvToolWrapper() {
  const { state, setParam, oversizeKeys } = useUrlSyncedState("csv", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  return (
    <ToolPageWrapper
      toolId="csv"
      title="CSV"
      description="Edit massive CSV files, convert Excel sheets, freeze rows/columns, and download as CSV or XLSX."
      scrollArea={false}
    >
      <CsvToolContent state={state} setParam={setParam} oversizeKeys={oversizeKeys} />
    </ToolPageWrapper>
  )
}

function CsvToolContent({
  state,
  setParam,
  oversizeKeys,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
}) {
  const [files, setFiles] = React.useState<CsvFileMeta[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [downloadError, setDownloadError] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isSizing, setIsSizing] = React.useState(false)
  const [editingFileId, setEditingFileId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState("")
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const dirInputRef = React.useRef<HTMLInputElement | null>(null)
  const renameInputRef = React.useRef<HTMLInputElement | null>(null)
  const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const hasLoadedRef = React.useRef(false)
  const [persistNonce, setPersistNonce] = React.useState(0)

  // Data store lives in a ref to avoid cloning huge arrays on every edit
  const dataStoreRef = React.useRef<Map<string, string[][]>>(new Map())
  const markDirty = React.useCallback(() => {
    if (!hasLoadedRef.current) return
    setPersistNonce((prev) => prev + 1)
  }, [])

  const activeFile = React.useMemo(
    () => files.find((file) => file.id === state.activeFileId) || files[0],
    [files, state.activeFileId],
  )

  React.useEffect(() => {
    if (!activeFile) return
    if (activeFile.freezeRows !== state.freezeRows) {
      setParam("freezeRows", activeFile.freezeRows, true)
    }
    if (activeFile.freezeCols !== state.freezeCols) {
      setParam("freezeCols", activeFile.freezeCols, true)
    }
    if (activeFile.columnWidth !== state.columnWidth) {
      setParam("columnWidth", activeFile.columnWidth, true)
    }
    if (activeFile.rowHeight !== state.rowHeight) {
      setParam("rowHeight", activeFile.rowHeight, true)
    }
  }, [activeFile, setParam, state.freezeRows, state.freezeCols, state.columnWidth, state.rowHeight])

  React.useEffect(() => {
    if (!hasLoadedRef.current) return
    setPersistNonce((prev) => prev + 1)
  }, [state.activeFileId, state.freezeRows, state.freezeCols, state.columnWidth, state.rowHeight])

  React.useEffect(() => {
    if (editingFileId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingFileId])

  React.useEffect(() => {
    if (!hasLoadedRef.current) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      const data: Record<string, string[][]> = {}
      for (const file of files) {
        const rows = dataStoreRef.current.get(file.id)
        if (rows) {
          data[file.id] = rows
        }
      }
      const activeFileId =
        state.activeFileId && files.some((file) => file.id === state.activeFileId)
          ? state.activeFileId
          : files[0]?.id || ""
      saveCsvState({
        files,
        data,
        activeFileId,
      }).catch(() => {})
    }, 400)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [files, state.activeFileId, persistNonce])

  const calculateColumnCount = (rows: string[][]): number => {
    let max = 0
    for (const row of rows) {
      if (row.length > max) max = row.length
    }
    return max
  }

  const createBlankRows = (rowCount: number, columnCount: number): string[][] =>
    Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ""))

  const addFile = React.useCallback(
    (name: string, rows: string[][], overwriteId?: string) => {
      const id =
        overwriteId ||
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`)
      const rowCount = rows.length
      const columnCount = calculateColumnCount(rows)
      const meta: CsvFileMeta = {
        id,
        name,
        freezeRows: 0,
        freezeCols: 0,
        columnWidth: state.columnWidth,
        rowHeight: state.rowHeight,
        columnWidthOverrides: {},
        rowHeightOverrides: {},
        rowCount,
        columnCount,
      }

      dataStoreRef.current.set(id, rows)
      setFiles((prev) => {
        const existingIndex = prev.findIndex((f) => f.id === id || f.name === name)
        if (existingIndex >= 0) {
          const next = [...prev]
          next[existingIndex] = meta
          return next
        }
        return [...prev, meta]
      })
      setParam("activeFileId", id, true)
      setParam("freezeRows", 0, true)
      setParam("freezeCols", 0, true)
      markDirty()
    },
    [markDirty, setParam, state.columnWidth, state.rowHeight],
  )

  const getUniqueName = React.useCallback(
    (baseName: string) => {
      if (!files.some((file) => file.name === baseName)) return baseName
      const suffixMatch = baseName.match(/^(.*?)(\.csv)$/i)
      const stem = suffixMatch ? suffixMatch[1] : baseName
      const ext = suffixMatch ? suffixMatch[2] : ".csv"
      let counter = 2
      while (files.some((file) => file.name === `${stem}-${counter}${ext}`)) {
        counter++
      }
      return `${stem}-${counter}${ext}`
    },
    [files],
  )

  React.useEffect(() => {
    if (hasLoadedRef.current) return
    let active = true
    loadCsvState()
      .then((saved) => {
        if (!active) return
        if (!saved || saved.files.length === 0) {
          hasLoadedRef.current = true
          addFile(getUniqueName("untitled.csv"), createBlankRows(10, 10))
          return
        }
        dataStoreRef.current = new Map(
          Object.entries(saved.data).map(([id, rows]) => [id, rows]),
        )
        setFiles(saved.files)
        const candidateId =
          state.activeFileId && saved.files.some((file) => file.id === state.activeFileId)
            ? state.activeFileId
            : saved.activeFileId
        const nextActiveId =
          candidateId && saved.files.some((file) => file.id === candidateId)
            ? candidateId
            : saved.files[0]?.id || ""
        setParam("activeFileId", nextActiveId, true)
        const activeMeta = saved.files.find((file) => file.id === nextActiveId)
        if (activeMeta) {
          setParam("freezeRows", activeMeta.freezeRows, true)
          setParam("freezeCols", activeMeta.freezeCols, true)
          setParam("columnWidth", activeMeta.columnWidth, true)
          setParam("rowHeight", activeMeta.rowHeight, true)
        }
        hasLoadedRef.current = true
      })
      .catch(() => {
        hasLoadedRef.current = true
      })
    return () => {
      active = false
    }
  }, [addFile, getUniqueName, setParam, state.activeFileId])

  const handleFilesUpload = React.useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return
      setIsProcessing(true)
      setError(null)

      const currentFiles = [...files]
      try {
        for (const file of Array.from(list)) {
          const lower = file.name.toLowerCase()
          let parsed: CsvFileData[] = []

          try {
            if (lower.endsWith(".csv")) {
              parsed = [await readCsvFile(file)]
            } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
              parsed = await readExcelFile(file)
            } else {
              continue
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to read file.")
            continue
          }

          for (const entry of parsed) {
            const existing = currentFiles.find((f) => f.name === entry.name)
            if (existing) {
              const overwrite =
                typeof window !== "undefined"
                  ? window.confirm(`File "${entry.name}" already exists. Overwrite?`)
                  : false
              if (!overwrite) continue
              dataStoreRef.current.delete(existing.id)
              addFile(entry.name, entry.rows, existing.id)
            } else {
              addFile(entry.name, entry.rows)
              currentFiles.push({
                id: "tmp",
                name: entry.name,
                freezeRows: 0,
                freezeCols: 0,
                columnWidth: state.columnWidth,
                rowHeight: state.rowHeight,
                columnWidthOverrides: {},
                rowHeightOverrides: {},
                rowCount: entry.rows.length,
                columnCount: calculateColumnCount(entry.rows),
              })
            }
          }
        }
      } finally {
        setIsProcessing(false)
      }
    },
    [addFile, calculateColumnCount, files, state.columnWidth, state.rowHeight],
  )

  const activeRows = activeFile ? dataStoreRef.current.get(activeFile.id) || [] : []

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!activeFile) return
    const rows = dataStoreRef.current.get(activeFile.id)
    if (!rows) return
    if (!rows[rowIndex]) {
      rows[rowIndex] = []
    }
    rows[rowIndex][colIndex] = value
    const nextColumnCount = Math.max(activeFile.columnCount, colIndex + 1)
    const nextRowCount = Math.max(activeFile.rowCount, rowIndex + 1)
    dataStoreRef.current.set(activeFile.id, rows)
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id
          ? { ...file, columnCount: nextColumnCount, rowCount: nextRowCount }
          : file,
      ),
    )
    markDirty()
  }

  const handleAddRow = () => {
    if (!activeFile) return
    const rows = dataStoreRef.current.get(activeFile.id) || []
    const newRow = Array.from({ length: activeFile.columnCount || 1 }, () => "")
    rows.push(newRow)
    dataStoreRef.current.set(activeFile.id, rows)
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id ? { ...file, rowCount: rows.length } : file,
      ),
    )
    markDirty()
  }

  const handleAddColumn = () => {
    if (!activeFile) return
    const nextCount = activeFile.columnCount + 1
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id ? { ...file, columnCount: nextCount } : file,
      ),
    )
    markDirty()
  }

  const handleInsertRow = (index: number, count: number) => {
    if (!activeFile) return
    if (count <= 0) return
    const rows = dataStoreRef.current.get(activeFile.id) || []
    const safeIndex = Math.max(0, Math.min(index, rows.length))
    const rowTemplate = Array.from({ length: activeFile.columnCount || 1 }, () => "")
    const newRows = Array.from({ length: count }, () => rowTemplate.slice())
    rows.splice(safeIndex, 0, ...newRows)
    dataStoreRef.current.set(activeFile.id, rows)
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              rowCount: rows.length,
              rowHeightOverrides: Object.fromEntries(
                Object.entries(file.rowHeightOverrides).map(([key, value]) => {
                  const idx = Number(key)
                  return [idx >= safeIndex ? idx + count : idx, value]
                }),
              ),
            }
          : file,
      ),
    )
    markDirty()
  }

  const handleInsertColumn = (index: number, count: number) => {
    if (!activeFile) return
    if (count <= 0) return
    const rows = dataStoreRef.current.get(activeFile.id) || []
    const safeIndex = Math.max(0, Math.min(index, activeFile.columnCount))
    for (const row of rows) {
      while (row.length < activeFile.columnCount) row.push("")
      row.splice(safeIndex, 0, ...Array.from({ length: count }, () => ""))
    }
    dataStoreRef.current.set(activeFile.id, rows)
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              columnCount: activeFile.columnCount + count,
              columnWidthOverrides: Object.fromEntries(
                Object.entries(file.columnWidthOverrides).map(([key, value]) => {
                  const idx = Number(key)
                  return [idx >= safeIndex ? idx + count : idx, value]
                }),
              ),
            }
          : file,
      ),
    )
    markDirty()
  }

  const handleFreezeChange = (nextRows: number, nextCols: number) => {
    if (!activeFile) return
    const clampedRows = Math.max(0, Math.min(nextRows, activeFile.rowCount))
    const clampedCols = Math.max(0, Math.min(nextCols, activeFile.columnCount))
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id ? { ...file, freezeRows: clampedRows, freezeCols: clampedCols } : file,
      ),
    )
    setParam("freezeRows", clampedRows, true)
    setParam("freezeCols", clampedCols, true)
    markDirty()
  }

  const updateColumnWidth = (columnIndex: number, value: number) => {
    if (!activeFile) return
    const clamped = Math.max(40, Math.min(value, 800))
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              columnWidthOverrides: { ...file.columnWidthOverrides, [columnIndex]: clamped },
            }
          : file,
      ),
    )
    markDirty()
  }

  const updateRowHeight = (rowIndex: number, value: number) => {
    if (!activeFile) return
    const clamped = Math.max(20, Math.min(value, 200))
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              rowHeightOverrides: { ...file.rowHeightOverrides, [rowIndex]: clamped },
            }
          : file,
      ),
    )
    markDirty()
  }

  const updateDefaultSizing = (key: "columnWidth" | "rowHeight", value: number) => {
    if (!activeFile) return
    const clamped =
      key === "columnWidth" ? Math.max(40, Math.min(value, 800)) : Math.max(20, Math.min(value, 200))
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              [key]: clamped,
              ...(key === "columnWidth" ? { columnWidthOverrides: {} } : { rowHeightOverrides: {} }),
            }
          : file,
      ),
    )
    setParam(key, clamped, true)
    markDirty()
  }

  const scanForMax = React.useCallback(async (rows: string[][], mode: "width" | "height") => {
    return new Promise<number>((resolve) => {
      let rowIndex = 0
      let maxValue = 0

      const schedule = (cb: (deadline?: { timeRemaining: () => number }) => void) => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          ;(window as any).requestIdleCallback(cb)
        } else {
          setTimeout(() => cb(undefined), 0)
        }
      }

      const work = (deadline?: { timeRemaining: () => number }) => {
        const start = typeof performance !== "undefined" ? performance.now() : Date.now()
        while (rowIndex < rows.length) {
          const row = rows[rowIndex]
          for (const cell of row) {
            if (mode === "width") {
              if (cell.length > maxValue) maxValue = cell.length
            } else {
              const height = cell ? cell.split(/\r?\n/).length : 1
              if (height > maxValue) maxValue = height
            }
          }
          rowIndex++
          const timeRemaining = deadline ? deadline.timeRemaining() : 0
          const elapsed =
            typeof performance !== "undefined" ? performance.now() - start : Date.now() - start
          if (deadline ? timeRemaining < 5 : elapsed > 16) break
        }

        if (rowIndex < rows.length) {
          schedule(work)
        } else {
          resolve(maxValue)
        }
      }

      schedule(work)
    })
  }, [])

  const handleAutoWidthAll = async () => {
    if (!activeFile) return
    const rows = dataStoreRef.current.get(activeFile.id) || []
    setIsSizing(true)
    try {
      const maxLength = await scanForMax(rows, "width")
      const nextWidth = Math.max(80, Math.min(800, maxLength * 8 + 24))
      updateDefaultSizing("columnWidth", nextWidth)
    } finally {
      setIsSizing(false)
    }
  }

  const handleAutoHeightAll = async () => {
    if (!activeFile) return
    const rows = dataStoreRef.current.get(activeFile.id) || []
    setIsSizing(true)
    try {
      const maxLines = await scanForMax(rows, "height")
      const nextHeight = Math.max(24, Math.min(200, maxLines * 20 + 12))
      updateDefaultSizing("rowHeight", nextHeight)
    } finally {
      setIsSizing(false)
    }
  }

  const handleAutoColumnWidth = (columnIndex: number) => {
    if (!activeFile) return
    const rows = dataStoreRef.current.get(activeFile.id) || []
    let maxLength = 0
    for (const row of rows) {
      const cell = row[columnIndex] ?? ""
      if (cell.length > maxLength) maxLength = cell.length
    }
    const nextWidth = Math.max(80, Math.min(800, maxLength * 8 + 24))
    updateColumnWidth(columnIndex, nextWidth)
  }

  const handleAutoRowHeight = (rowIndex: number) => {
    if (!activeFile) return
    const rows = dataStoreRef.current.get(activeFile.id) || []
    const row = rows[rowIndex] || []
    let maxLines = 1
    for (const cell of row) {
      const lines = cell ? cell.split(/\r?\n/).length : 1
      if (lines > maxLines) maxLines = lines
    }
    const nextHeight = Math.max(24, Math.min(200, maxLines * 20 + 12))
    updateRowHeight(rowIndex, nextHeight)
  }

  const handleDownloadCsv = (target: "active" | "all") => {
    setDownloadError(null)
    const targetFiles =
      target === "active" && activeFile ? [activeFile] : target === "all" ? files : []

    if (!targetFiles.length) {
      setDownloadError("No files available to download.")
      return
    }

    if (targetFiles.length === 1) {
      const file = targetFiles[0]
      const rows = dataStoreRef.current.get(file.id)
      if (!rows) {
        setDownloadError("No data to download.")
        return
      }
      const csv = stringifyCsv(rows)
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = file.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      return
    }

    const zip = new JSZip()
    for (const file of targetFiles) {
      const rows = dataStoreRef.current.get(file.id)
      if (!rows) continue
      zip.file(file.name, stringifyCsv(rows))
    }

    zip
      .generateAsync({ type: "blob" })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "csv-files.zip"
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 0)
      })
      .catch(() => setDownloadError("Failed to build zip archive."))
  }

  const handleDownloadXlsx = () => {
    setDownloadError(null)
    if (!files.length) {
      setDownloadError("No files available to download.")
      return
    }

    const workbook = XLSX.utils.book_new()
    const usedNames = new Set<string>()

    for (const file of files) {
      const rows = dataStoreRef.current.get(file.id) || []
      let baseName = stripCsvExtension(file.name)
      if (!isValidSheetName(baseName)) {
        setDownloadError(
          `Sheet name "${baseName}" is invalid or too long (max ${31} characters).`,
        )
        return
      }

      let sheetName = baseName
      let counter = 1
      while (usedNames.has(sheetName)) {
        sheetName = `${baseName}_${counter}`
        counter++
        if (!isValidSheetName(sheetName)) {
          setDownloadError(
            `Sheet name "${sheetName}" is invalid or too long (max ${31} characters).`,
          )
          return
        }
      }
      usedNames.add(sheetName)

      const sheet = rowsToWorksheet(rows)
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
    }

    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "csv-files.xlsx"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleCreateBlank = () => {
    const baseName = "untitled.csv"
    addFile(getUniqueName(baseName), createBlankRows(10, 10))
  }

  const handleStartRename = (fileId: string, currentName: string) => {
    setEditingFileId(fileId)
    const nameWithoutExt = currentName.replace(/\.csv$/i, "")
    setEditingName(nameWithoutExt)
  }

  const handleFinishRename = () => {
    if (!editingFileId) return
    const trimmed = editingName.trim().replace(/\.csv$/i, "")
    if (!trimmed) {
      setEditingFileId(null)
      return
    }
    const finalName = `${trimmed}.csv`
    const conflict = files.some((file) => file.name === finalName && file.id !== editingFileId)
    if (conflict) {
      alert(`File "${finalName}" already exists. Choose a different name.`)
      return
    }
    setFiles((prev) =>
      prev.map((file) => (file.id === editingFileId ? { ...file, name: finalName } : file)),
    )
    setEditingFileId(null)
    markDirty()
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleFinishRename()
    } else if (e.key === "Escape") {
      setEditingFileId(null)
    }
  }

  const handleRemoveFile = (id: string) => {
    const nextFiles = files.filter((file) => file.id !== id)
    setFiles(nextFiles)
    const nextActive = state.activeFileId === id ? nextFiles[0]?.id || "" : state.activeFileId
    setParam("activeFileId", nextActive, true)
    dataStoreRef.current.delete(id)
    markDirty()
  }

  const handleClearAll = async () => {
    await clearCsvState()
    setFiles([])
    dataStoreRef.current.clear()
    setParam("activeFileId", "", true)
    setParam("freezeRows", 0, true)
    setParam("freezeCols", 0, true)
    setParam("columnWidth", 140, true)
    setParam("rowHeight", 32, true)
    markDirty()
  }

  const inputWarning = oversizeKeys.length ? "Some parameters are not synced due to size limits." : null

  return (
    <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              void handleFilesUpload(e.target.files)
              e.target.value = ""
            }}
            className="hidden"
          />
          <input
            ref={dirInputRef}
            type="file"
            multiple
            // @ts-expect-error directory upload
            webkitdirectory="true"
            onChange={(e) => {
              void handleFilesUpload(e.target.files)
              e.target.value = ""
            }}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1"
          >
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => dirInputRef.current?.click()}
            className="gap-1"
          >
            <FolderOpen className="h-4 w-4" />
            Upload Folder
          </Button>
          <Button variant="outline" size="sm" onClick={handleCreateBlank} className="gap-1">
            <Plus className="h-4 w-4" />
            New File
          </Button>
          <div className="mx-3 h-6 border-l" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownloadCsv("active")}
            disabled={!activeFile}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownloadCsv("all")}
            disabled={!files.length}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            CSV (Zip)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadXlsx}
            disabled={!files.length}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            XLSX
          </Button>
          <div className="mx-3 h-6 border-l" />
          <Button variant="ghost" size="sm" onClick={handleClearAll} className="gap-1">
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>

        {(error || downloadError) && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error || downloadError}</AlertDescription>
          </Alert>
        )}
        {(isProcessing || isSizing) && (
          <Alert className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {isProcessing ? "Processing files..." : "Auto-sizing columns/rows..."}
            </AlertDescription>
          </Alert>
        )}
        {inputWarning && (
          <Alert className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{inputWarning}</AlertDescription>
          </Alert>
        )}

            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">No files loaded</p>
                  <p className="text-xs text-muted-foreground">
                    Upload CSV/XLSX files or create a blank file to start editing.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCreateBlank} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Blank file
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 flex-wrap items-center gap-0 border-b">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={cn(
                          "group relative flex h-8 shrink-0 items-center border-b-2 px-3 text-xs transition-colors",
                          file.id === activeFile?.id
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
                            className="h-5 w-32 px-1 text-xs"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setParam("activeFileId", file.id, true)}
                            onDoubleClick={() => handleStartRename(file.id, file.name)}
                            className="max-w-[200px] truncate"
                            title="Double-click to rename"
                          >
                            {file.name}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveFile(file.id)
                          }}
                          className="ml-1.5 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {activeFile && (
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {activeFile.rowCount.toLocaleString()} rows ·{" "}
                        {activeFile.columnCount.toLocaleString()} columns
                      </span>
                      <span className="text-muted-foreground">
                        Editing as text only. No type conversion occurs.
                      </span>
                    </div>
                    <CsvGrid
                      rows={activeRows}
                      rowCount={activeFile.rowCount}
                      columnCount={activeFile.columnCount || 1}
                      freezeRows={activeFile.freezeRows}
                      freezeCols={activeFile.freezeCols}
                      defaultColumnWidth={activeFile.columnWidth}
                      defaultRowHeight={activeFile.rowHeight}
                      columnWidthOverrides={activeFile.columnWidthOverrides}
                      rowHeightOverrides={activeFile.rowHeightOverrides}
                      onColumnWidthChange={updateColumnWidth}
                      onRowHeightChange={updateRowHeight}
                      onAutoColumnWidth={handleAutoColumnWidth}
                      onAutoRowHeight={handleAutoRowHeight}
                      onAutoAllColumns={handleAutoWidthAll}
                      onAutoAllRows={handleAutoHeightAll}
                      onFreezeChange={handleFreezeChange}
                      onAddRow={handleAddRow}
                      onAddColumn={handleAddColumn}
                      onInsertRow={handleInsertRow}
                      onInsertColumn={handleInsertColumn}
                      onCellChange={handleCellChange}
                    />
                  </div>
                )}
              </>
            )}
    </div>
  )
}
