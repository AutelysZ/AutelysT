"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"

type CsvGridProps = {
  rows: string[][]
  rowCount: number
  columnCount: number
  freezeRows: number
  freezeCols: number
  defaultColumnWidth: number
  defaultRowHeight: number
  columnWidthOverrides: Record<number, number>
  rowHeightOverrides: Record<number, number>
  onColumnWidthChange: (columnIndex: number, value: number) => void
  onRowHeightChange: (rowIndex: number, value: number) => void
  onAutoColumnWidth: (columnIndex: number) => void
  onAutoRowHeight: (rowIndex: number) => void
  onAutoAllColumns: () => void
  onAutoAllRows: () => void
  onFreezeChange: (rows: number, cols: number) => void
  onAddRow: () => void
  onAddColumn: () => void
  onInsertRow: (index: number, count: number) => void
  onInsertColumn: (index: number, count: number) => void
  onCellChange: (rowIndex: number, columnIndex: number, value: string) => void
}

const ROW_NUMBER_WIDTH = 64
const BUFFER_ROWS = 20
const INSERT_COUNT_OPTIONS = Array.from({ length: 9 }, (_, index) => index + 1)

function getColumnLabel(index: number): string {
  let num = index + 1
  let label = ""
  while (num > 0) {
    const rem = (num - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    num = Math.floor((num - 1) / 26)
  }
  return label
}

type DragState =
  | { type: "column"; columnIndex: number; startX: number; startWidth: number }
  | { type: "row"; rowIndex: number; startY: number; startHeight: number }
  | { type: "freezeCols"; originLeft: number }
  | { type: "freezeRows"; originTop: number }

export function CsvGrid({
  rows,
  rowCount,
  columnCount,
  freezeRows,
  freezeCols,
  defaultColumnWidth,
  defaultRowHeight,
  columnWidthOverrides,
  rowHeightOverrides,
  onColumnWidthChange,
  onRowHeightChange,
  onAutoColumnWidth,
  onAutoRowHeight,
  onAutoAllColumns,
  onAutoAllRows,
  onFreezeChange,
  onAddRow,
  onAddColumn,
  onInsertRow,
  onInsertColumn,
  onCellChange,
}: CsvGridProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [scrollLeft, setScrollLeft] = React.useState(0)
  const [viewportHeight, setViewportHeight] = React.useState(400)
  const [contextTarget, setContextTarget] = React.useState<{ row: number | null; col: number | null }>({
    row: null,
    col: null,
  })

  React.useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && entry.contentRect) {
        setViewportHeight(entry.contentRect.height)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    setScrollTop(0)
  }, [rowCount, columnCount, defaultRowHeight])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
    setScrollLeft(e.currentTarget.scrollLeft)
  }

  const headerHeight = defaultRowHeight
  const columnWidths = React.useMemo(() => {
    const widths = new Array(columnCount).fill(defaultColumnWidth)
    for (const [key, value] of Object.entries(columnWidthOverrides)) {
      const index = Number(key)
      if (index >= 0 && index < columnCount) {
        widths[index] = value
      }
    }
    return widths
  }, [columnCount, columnWidthOverrides, defaultColumnWidth])

  const columnOffsets = React.useMemo(() => {
    const offsets = new Array(columnCount + 1).fill(0)
    for (let i = 0; i < columnCount; i++) {
      offsets[i + 1] = offsets[i] + columnWidths[i]
    }
    return offsets
  }, [columnCount, columnWidths])

  const columnTemplate = React.useMemo(
    () => columnWidths.map((width) => `${width}px`).join(" "),
    [columnWidths],
  )

  const getColumnIndexFromOffset = React.useCallback(
    (offset: number) => {
      if (offset <= 0) return 0
      let left = 0
      let right = columnOffsets.length - 1
      while (left < right) {
        const mid = Math.floor((left + right) / 2)
        if (columnOffsets[mid] <= offset) {
          left = mid + 1
        } else {
          right = mid
        }
      }
      return Math.max(0, Math.min(columnCount, left - 1))
    },
    [columnOffsets, columnCount],
  )

  const rowOverrideEntries = React.useMemo(() => {
    const entries = Object.entries(rowHeightOverrides)
      .map(([key, value]) => {
        const index = Number(key)
        const extra = value - defaultRowHeight
        return Number.isFinite(index) && extra !== 0 ? { index, extra } : null
      })
      .filter((entry): entry is { index: number; extra: number } => !!entry)
      .sort((a, b) => a.index - b.index)

    const prefix: number[] = []
    let running = 0
    for (const entry of entries) {
      running += entry.extra
      prefix.push(running)
    }
    return { entries, prefix }
  }, [rowHeightOverrides, defaultRowHeight])

  const getExtraBefore = React.useCallback(
    (rowIndex: number) => {
      const { entries, prefix } = rowOverrideEntries
      if (entries.length === 0) return 0
      let left = 0
      let right = entries.length - 1
      let result = -1
      while (left <= right) {
        const mid = Math.floor((left + right) / 2)
        if (entries[mid].index < rowIndex) {
          result = mid
          left = mid + 1
        } else {
          right = mid - 1
        }
      }
      return result >= 0 ? prefix[result] : 0
    },
    [rowOverrideEntries],
  )

  const getRowHeight = React.useCallback(
    (rowIndex: number) => rowHeightOverrides[rowIndex] ?? defaultRowHeight,
    [rowHeightOverrides, defaultRowHeight],
  )

  const totalWidth = ROW_NUMBER_WIDTH + columnOffsets[columnCount]
  const extraHeight = rowOverrideEntries.prefix[rowOverrideEntries.prefix.length - 1] ?? 0
  const totalHeight = headerHeight + Math.max(rowCount, 1) * defaultRowHeight + extraHeight
  const visibleHeight = Math.max(0, viewportHeight - headerHeight)

  const adjustedScrollTop = Math.max(0, scrollTop - headerHeight - freezeRows * defaultRowHeight)
  const startRow = Math.max(
    freezeRows,
    Math.floor(adjustedScrollTop / defaultRowHeight) - BUFFER_ROWS,
  )
  const endRow = Math.min(
    rowCount,
    startRow + Math.ceil(visibleHeight / defaultRowHeight) + BUFFER_ROWS * 2,
  )

  const renderRows = React.useMemo(() => {
    const indices = new Set<number>()
    for (let i = 0; i < Math.min(freezeRows, rowCount); i++) {
      indices.add(i)
    }
    for (let i = startRow; i < endRow; i++) {
      indices.add(i)
    }
    return Array.from(indices).sort((a, b) => a - b)
  }, [freezeRows, rowCount, startRow, endRow])

  const handlePointerMove = React.useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      if (drag.type === "column") {
        const nextWidth = Math.max(40, Math.min(800, drag.startWidth + (event.clientX - drag.startX)))
        onColumnWidthChange(drag.columnIndex, nextWidth)
        return
      }

      if (drag.type === "row") {
        const nextHeight = Math.max(20, Math.min(200, drag.startHeight + (event.clientY - drag.startY)))
        onRowHeightChange(drag.rowIndex, nextHeight)
        return
      }

      if (drag.type === "freezeCols") {
        const offset = event.clientX - drag.originLeft - ROW_NUMBER_WIDTH + scrollLeft
        const nextCols = getColumnIndexFromOffset(offset)
        onFreezeChange(freezeRows, nextCols)
        return
      }

      if (drag.type === "freezeRows") {
        const offset = event.clientY - drag.originTop - headerHeight + scrollTop
        const nextRows = Math.max(0, Math.min(rowCount, Math.round(offset / defaultRowHeight)))
        onFreezeChange(nextRows, freezeCols)
      }
    },
    [
      columnCount,
      defaultColumnWidth,
      defaultRowHeight,
      freezeCols,
      freezeRows,
      getColumnIndexFromOffset,
      headerHeight,
      onColumnWidthChange,
      onFreezeChange,
      onRowHeightChange,
      rowCount,
      scrollLeft,
      scrollTop,
    ],
  )

  const handlePointerUp = React.useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null
    if (typeof document !== "undefined") {
      document.body.style.cursor = ""
    }
  }, [])

  React.useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  const startColumnResize = (event: React.PointerEvent, columnIndex: number) => {
    dragRef.current = {
      type: "column",
      columnIndex,
      startX: event.clientX,
      startWidth: columnWidths[columnIndex] ?? defaultColumnWidth,
    }
    document.body.style.cursor = "col-resize"
    event.preventDefault()
  }

  const startRowResize = (event: React.PointerEvent, rowIndex: number) => {
    dragRef.current = {
      type: "row",
      rowIndex,
      startY: event.clientY,
      startHeight: getRowHeight(rowIndex),
    }
    document.body.style.cursor = "row-resize"
    event.preventDefault()
  }

  const startFreezeCols = (event: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { type: "freezeCols", originLeft: rect.left }
    document.body.style.cursor = "col-resize"
    event.preventDefault()
  }

  const startFreezeRows = (event: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { type: "freezeRows", originTop: rect.top }
    document.body.style.cursor = "row-resize"
    event.preventDefault()
  }

  const freezeLineLeft = ROW_NUMBER_WIDTH + columnOffsets[freezeCols] + scrollLeft
  const freezeLineTop =
    headerHeight + freezeRows * defaultRowHeight + getExtraBefore(freezeRows) + scrollTop

  const hasRow = contextTarget.row !== null
  const hasCol = contextTarget.col !== null
  const targetRow = contextTarget.row ?? 0
  const targetCol = contextTarget.col ?? 0
  const frozenCellClass = (isFrozenRow: boolean, isFrozenCol: boolean) => {
    if (isFrozenRow && isFrozenCol) return "sticky z-30 bg-background"
    if (isFrozenRow) return "sticky z-20 bg-background"
    if (isFrozenCol) return "sticky z-10 bg-background"
    return ""
  }

  const handleContextMenuCapture = React.useCallback((event: React.MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-csv-context]")
    if (!target) {
      setContextTarget({ row: null, col: null })
      return
    }
    const rowAttr = target.getAttribute("data-row")
    const colAttr = target.getAttribute("data-col")
    const row = rowAttr !== null ? Number(rowAttr) : null
    const col = colAttr !== null ? Number(colAttr) : null
    setContextTarget({ row: Number.isNaN(row) ? null : row, col: Number.isNaN(col) ? null : col })
  }, [])

  const promptForCount = React.useCallback((label: string) => {
    if (typeof window === "undefined") return null
    const raw = window.prompt(`Add how many ${label}?`, "10")
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  }, [])

  const handleInsertRows = React.useCallback(
    (index: number, count: number) => {
      if (count <= 0) return
      onInsertRow(index, count)
    },
    [onInsertRow],
  )

  const handleInsertColumns = React.useCallback(
    (index: number, count: number) => {
      if (count <= 0) return
      onInsertColumn(index, count)
    },
    [onInsertColumn],
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          className="h-[520px] w-full min-w-0 max-w-full overflow-auto rounded-md border"
          onScroll={handleScroll}
          onContextMenuCapture={handleContextMenuCapture}
          role="grid"
          aria-rowcount={rowCount}
          aria-colcount={columnCount}
        >
          <div
            className="relative"
            style={{
              height: totalHeight,
              width: totalWidth,
            }}
          >
        <div className="sticky top-0 z-40 flex" style={{ height: headerHeight }}>
          <div
            className="sticky left-0 z-50 flex h-full items-center justify-center border-b border-r bg-muted text-xs text-muted-foreground"
            style={{ width: ROW_NUMBER_WIDTH }}
            data-csv-context
          />
          <div
            className="flex"
            style={{
              width: columnOffsets[columnCount],
            }}
          >
            {Array.from({ length: columnCount }).map((_, colIndex) => {
              const isFrozenCol = colIndex < freezeCols
              const left = ROW_NUMBER_WIDTH + columnOffsets[colIndex]
              return (
              <div
                key={`header-${colIndex}`}
                className={cn(
                  "relative flex h-full items-center justify-center border-b border-r bg-muted text-xs font-medium text-foreground",
                  isFrozenCol && "sticky z-40 bg-muted",
                )}
                style={{
                  width: columnWidths[colIndex],
                  left: isFrozenCol ? left : undefined,
                }}
                data-csv-context
                data-col={colIndex}
              >
                {getColumnLabel(colIndex)}
                <div
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
                  onPointerDown={(event) => startColumnResize(event, colIndex)}
                  onDoubleClick={() => onAutoColumnWidth(colIndex)}
                />
              </div>
              )
            })}
          </div>
        </div>

        <div
          className="absolute left-0 top-0 h-full w-2 cursor-col-resize"
          style={{ left: freezeLineLeft - 1 }}
          onPointerDown={startFreezeCols}
          title="Drag to set frozen columns"
        />
        <div
          className="absolute left-0 h-2 w-full cursor-row-resize"
          style={{ top: freezeLineTop - 1 }}
          onPointerDown={startFreezeRows}
          title="Drag to set frozen rows"
        />
        <div
          className="absolute top-0 bottom-0 z-50 w-px bg-muted-foreground/40"
          style={{ left: freezeLineLeft }}
        />
        <div
          className="absolute left-0 right-0 z-50 h-px bg-muted-foreground/40"
          style={{ top: freezeLineTop }}
        />

        {renderRows.map((rowIndex) => {
          const rowHeightValue = getRowHeight(rowIndex)
          const baseTop = headerHeight + rowIndex * defaultRowHeight + getExtraBefore(rowIndex)
          const row = rows[rowIndex] || []
          const isFrozenRow = rowIndex < freezeRows
          const top = isFrozenRow ? baseTop + scrollTop : baseTop

          return (
            <div
              key={`row-${rowIndex}`}
              className={cn("absolute flex", isFrozenRow && "z-20")}
              style={{
                top,
                left: 0,
                right: 0,
                height: rowHeightValue,
              }}
            >
              <div
                className={cn(
                  "sticky left-0 flex h-full items-center border-b border-r bg-muted px-2 text-xs text-muted-foreground",
                  isFrozenRow ? "z-40" : "z-10",
                )}
                style={{
                  width: ROW_NUMBER_WIDTH,
                }}
                data-csv-context
                data-row={rowIndex}
              >
                {rowIndex + 1}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize"
                  onPointerDown={(event) => startRowResize(event, rowIndex)}
                  onDoubleClick={() => onAutoRowHeight(rowIndex)}
                />
              </div>

              <div
                className="grid h-full"
                style={{
                  gridTemplateColumns: columnTemplate,
                  minWidth: columnOffsets[columnCount],
                }}
              >
                {Array.from({ length: columnCount }).map((_, colIndex) => {
                  const isFrozenCol = colIndex < freezeCols
                  const left = ROW_NUMBER_WIDTH + columnOffsets[colIndex]
                  const width = columnWidths[colIndex] ?? defaultColumnWidth
                  const value = row[colIndex] ?? ""

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={cn(
                        "flex h-full items-center border-b border-r bg-background px-1",
                        frozenCellClass(isFrozenRow, isFrozenCol),
                      )}
                      style={{
                        left: isFrozenCol ? left : undefined,
                        width,
                      }}
                      data-csv-context
                      data-row={rowIndex}
                      data-col={colIndex}
                    >
                      <Input
                        value={value}
                        onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
                        className="h-full w-full border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                        aria-label={`Row ${rowIndex + 1} Column ${colIndex + 1}`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onAddRow}>Add row at end</ContextMenuItem>
        <ContextMenuItem onSelect={onAddColumn}>Add column at end</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => handleInsertRows(Math.max(0, targetRow), 1)}
          disabled={!hasRow && rowCount === 0}
        >
          Insert row above
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={!hasRow && rowCount === 0}>
            Insert rows above...
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {INSERT_COUNT_OPTIONS.map((count) => (
              <ContextMenuItem
                key={`insert-rows-above-${count}`}
                onSelect={() => handleInsertRows(Math.max(0, targetRow), count)}
              >
                Add {count} row{count === 1 ? "" : "s"}
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                const count = promptForCount("rows")
                if (count) handleInsertRows(Math.max(0, targetRow), count)
              }}
            >
              Custom...
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          onSelect={() => handleInsertRows(Math.max(0, targetRow + 1), 1)}
          disabled={!hasRow && rowCount === 0}
        >
          Insert row below
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={!hasRow && rowCount === 0}>
            Insert rows below...
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {INSERT_COUNT_OPTIONS.map((count) => (
              <ContextMenuItem
                key={`insert-rows-below-${count}`}
                onSelect={() => handleInsertRows(Math.max(0, targetRow + 1), count)}
              >
                Add {count} row{count === 1 ? "" : "s"}
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                const count = promptForCount("rows")
                if (count) handleInsertRows(Math.max(0, targetRow + 1), count)
              }}
            >
              Custom...
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          onSelect={() => handleInsertColumns(Math.max(0, targetCol), 1)}
          disabled={!hasCol && columnCount === 0}
        >
          Insert column left
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={!hasCol && columnCount === 0}>
            Insert columns left...
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {INSERT_COUNT_OPTIONS.map((count) => (
              <ContextMenuItem
                key={`insert-cols-left-${count}`}
                onSelect={() => handleInsertColumns(Math.max(0, targetCol), count)}
              >
                Add {count} column{count === 1 ? "" : "s"}
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                const count = promptForCount("columns")
                if (count) handleInsertColumns(Math.max(0, targetCol), count)
              }}
            >
              Custom...
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          onSelect={() => handleInsertColumns(Math.max(0, targetCol + 1), 1)}
          disabled={!hasCol && columnCount === 0}
        >
          Insert column right
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={!hasCol && columnCount === 0}>
            Insert columns right...
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {INSERT_COUNT_OPTIONS.map((count) => (
              <ContextMenuItem
                key={`insert-cols-right-${count}`}
                onSelect={() => handleInsertColumns(Math.max(0, targetCol + 1), count)}
              >
                Add {count} column{count === 1 ? "" : "s"}
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                const count = promptForCount("columns")
                if (count) handleInsertColumns(Math.max(0, targetCol + 1), count)
              }}
            >
              Custom...
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => onAutoColumnWidth(targetCol)}
          disabled={!hasCol}
        >
          Auto-fit this column
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onAutoRowHeight(targetRow)}
          disabled={!hasRow}
        >
          Auto-fit this row
        </ContextMenuItem>
        <ContextMenuItem onSelect={onAutoAllColumns}>Auto-fit all columns</ContextMenuItem>
        <ContextMenuItem onSelect={onAutoAllRows}>Auto-fit all rows</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => onFreezeChange(targetRow + 1, freezeCols)}
          disabled={!hasRow}
        >
          Freeze rows up to here
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onFreezeChange(freezeRows, targetCol + 1)}
          disabled={!hasCol}
        >
          Freeze columns up to here
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onFreezeChange(targetRow + 1, targetCol + 1)}
          disabled={!hasRow || !hasCol}
        >
          Freeze panes here
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onFreezeChange(0, 0)}>Unfreeze all</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
