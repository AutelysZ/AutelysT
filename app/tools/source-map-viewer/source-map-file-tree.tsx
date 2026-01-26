"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileJson,
  Folder,
  FolderOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceTreeNode } from "./source-map-viewer-types";

type SourceMapFileTreeProps = {
  nodes: SourceTreeNode[];
  activeFileId: string;
  onSelect: (node: SourceTreeNode) => void;
  onDelete?: (node: SourceTreeNode) => void;
  canDeleteNode?: (node: SourceTreeNode) => boolean;
};

function collectDirectoryIds(nodes: SourceTreeNode[], set: Set<string>) {
  for (const node of nodes) {
    if (node.type === "directory") {
      set.add(node.id);
      if (node.children) collectDirectoryIds(node.children, set);
    }
  }
}

export default function SourceMapFileTree({
  nodes,
  activeFileId,
  onSelect,
  onDelete,
  canDeleteNode,
}: SourceMapFileTreeProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const next = new Set<string>();
    collectDirectoryIds(nodes, next);
    setExpandedIds(next);
  }, [nodes]);

  const toggleExpanded = React.useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const renderNode = (node: SourceTreeNode, depth: number) => {
    const isDirectory = node.type === "directory";
    const isExpanded = isDirectory && expandedIds.has(node.id);
    const isActive = !!node.fileId && node.fileId === activeFileId;
    const canDelete =
      Boolean(onDelete) &&
      (canDeleteNode ? canDeleteNode(node) : node.id !== "root");
    const isMapRoot = node.kind === "map-root";

    return (
      <div key={node.id}>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left font-mono text-xs leading-5 transition-colors hover:bg-muted/60",
            isActive && "bg-primary/10 text-primary",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() =>
            isDirectory ? toggleExpanded(node.id) : onSelect(node)
          }
        >
          {isDirectory ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
          {isDirectory ? (
            isMapRoot ? (
              <FileJson className="h-4 w-4 text-amber-500" />
            ) : isExpanded ? (
              <FolderOpen className="h-4 w-4 text-sky-500" />
            ) : (
              <Folder className="h-4 w-4 text-sky-500" />
            )
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 whitespace-nowrap" title={node.path}>
            {node.name}
          </span>
          {canDelete ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Delete ${node.name}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-all hover:bg-muted/60 hover:text-foreground group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.(node);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete?.(node);
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </button>
        {isDirectory &&
          isExpanded &&
          node.children &&
          node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (nodes.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        No sources loaded.
      </div>
    );
  }

  return (
    <div className="space-y-1 min-w-max">
      {nodes.map((node) => renderNode(node, 0))}
    </div>
  );
}
