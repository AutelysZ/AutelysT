"use client"

import * as React from "react"
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Download,
  GripVertical,
  Trash2,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type FileNode, formatFileSize, downloadFile } from "@/lib/archiver/codec"

interface FileTreeProps {
  nodes: FileNode[]
  onNodesChange: (nodes: FileNode[]) => void
  showDownload?: boolean
  showDelete?: boolean
  draggable?: boolean
}

export function FileTree({
  nodes,
  onNodesChange,
  showDownload = false,
  showDelete = false,
  draggable = false,
}: FileTreeProps) {
  const [draggedNode, setDraggedNode] = React.useState<FileNode | null>(null)
  const [dropTarget, setDropTarget] = React.useState<string | null>(null)

  const updateNode = (nodeId: string, updates: Partial<FileNode>) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, ...updates }
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) }
        }
        return node
      })
    }
    onNodesChange(updateNodes(nodes))
  }

  const toggleExpanded = (nodeId: string) => {
    const toggle = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, expanded: !node.expanded }
        }
        if (node.children) {
          return { ...node, children: toggle(node.children) }
        }
        return node
      })
    }
    onNodesChange(toggle(nodes))
  }

  const toggleSelected = (nodeId: string, selected: boolean) => {
    const updateSelection = (nodes: FileNode[], parentSelected?: boolean): FileNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          const newSelected = selected
          if (node.children) {
            return {
              ...node,
              selected: newSelected,
              children: updateChildrenSelection(node.children, newSelected),
            }
          }
          return { ...node, selected: newSelected }
        }
        if (node.children) {
          return { ...node, children: updateSelection(node.children, parentSelected) }
        }
        return node
      })
    }
    onNodesChange(updateSelection(nodes))
  }

  const updateChildrenSelection = (nodes: FileNode[], selected: boolean): FileNode[] => {
    return nodes.map((node) => {
      if (node.children) {
        return {
          ...node,
          selected,
          children: updateChildrenSelection(node.children, selected),
        }
      }
      return { ...node, selected }
    })
  }

  const deleteNode = (nodeId: string) => {
    const removeNode = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .filter((node) => node.id !== nodeId)
        .map((node) => {
          if (node.children) {
            return { ...node, children: removeNode(node.children) }
          }
          return node
        })
    }
    onNodesChange(removeNode(nodes))
  }

  const handleDragStart = (e: React.DragEvent, node: FileNode) => {
    if (!draggable) return
    setDraggedNode(node)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", node.id)
  }

  const handleDragOver = (e: React.DragEvent, targetNode: FileNode) => {
    if (!draggable || !draggedNode) return
    if (draggedNode.id === targetNode.id) return
    if (targetNode.type !== "directory") return

    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget(targetNode.id)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent, targetNode: FileNode) => {
    if (!draggable || !draggedNode) return
    if (draggedNode.id === targetNode.id) return
    if (targetNode.type !== "directory") return

    e.preventDefault()
    setDropTarget(null)

    // Move the node
    const moveNode = (nodes: FileNode[]): FileNode[] => {
      // First remove the dragged node
      const filtered = nodes
        .filter((node) => node.id !== draggedNode.id)
        .map((node) => {
          if (node.children) {
            return { ...node, children: moveNode(node.children) }
          }
          return node
        })

      // Then add it to the target
      return filtered.map((node) => {
        if (node.id === targetNode.id && node.children) {
          const newPath = `${node.path}/${draggedNode.name}`
          return {
            ...node,
            children: [
              ...node.children,
              { ...draggedNode, path: newPath },
            ],
          }
        }
        if (node.children) {
          return { ...node, children: moveNode(node.children) }
        }
        return node
      })
    }

    onNodesChange(moveNode(nodes))
    setDraggedNode(null)
  }

  const handleDragEnd = () => {
    setDraggedNode(null)
    setDropTarget(null)
  }

  const handleDownload = (node: FileNode) => {
    if (node.data) {
      downloadFile(node.data, node.name)
    }
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isDirectory = node.type === "directory"
    const isExpanded = node.expanded !== false
    const isDropTarget = dropTarget === node.id

    return (
      <div key={node.id}>
        <div
          className={cn(
            "group flex items-center gap-1 py-1 px-2 hover:bg-muted/50 rounded-sm transition-colors",
            isDropTarget && "bg-primary/10 ring-1 ring-primary",
            draggedNode?.id === node.id && "opacity-50"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          draggable={draggable}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
          onDragEnd={handleDragEnd}
        >
          {draggable && (
            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
          )}

          <Checkbox
            checked={node.selected}
            onCheckedChange={(checked) => toggleSelected(node.id, !!checked)}
            className="h-4 w-4"
          />

          {isDirectory ? (
            <button
              type="button"
              onClick={() => toggleExpanded(node.id)}
              className="flex items-center gap-1"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-blue-500" />
              )}
            </button>
          ) : (
            <>
              <span className="w-4" />
              <File className="h-4 w-4 text-muted-foreground" />
            </>
          )}

          <span className="flex-1 text-sm truncate" title={node.path}>
            {node.name}
          </span>

          {node.size !== undefined && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(node.size)}
            </span>
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            {showDownload && node.type === "file" && node.data && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleDownload(node)}
                title="Download file"
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
            {showDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => deleteNode(node.id)}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        No files
      </div>
    )
  }

  return (
    <div className="text-sm">
      {nodes.map((node) => renderNode(node, 0))}
    </div>
  )
}

// Select all / Deselect all helper
export function toggleAllSelection(nodes: FileNode[], selected: boolean): FileNode[] {
  return nodes.map((node) => ({
    ...node,
    selected,
    children: node.children ? toggleAllSelection(node.children, selected) : undefined,
  }))
}

// Count selected files
export function countSelectedFiles(nodes: FileNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === "file" && node.selected) {
      count++
    }
    if (node.children) {
      count += countSelectedFiles(node.children)
    }
  }
  return count
}

// Count total files
export function countTotalFiles(nodes: FileNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === "file") {
      count++
    }
    if (node.children) {
      count += countTotalFiles(node.children)
    }
  }
  return count
}
