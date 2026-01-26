"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "./file-type-detector-types";

type FileTypeDetectorFileTreeProps = {
  nodes: FileTreeNode[];
  activeFileId: string;
  onSelect: (fileId: string) => void;
};

function collectDirectoryIds(nodes: FileTreeNode[], set: Set<string>) {
  for (const node of nodes) {
    if (node.type === "directory") {
      set.add(node.id);
      if (node.children) collectDirectoryIds(node.children, set);
    }
  }
}

export default function FileTypeDetectorFileTree({
  nodes,
  activeFileId,
  onSelect,
}: FileTypeDetectorFileTreeProps) {
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

  const renderNode = (node: FileTreeNode, depth: number) => {
    const isDirectory = node.type === "directory";
    const isExpanded = isDirectory && expandedIds.has(node.id);
    const isActive = !!node.fileId && node.fileId === activeFileId;

    return (
      <div key={node.id}>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60",
            isActive && "bg-primary/10 text-primary",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() =>
            isDirectory
              ? toggleExpanded(node.id)
              : node.fileId && onSelect(node.fileId)
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
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-sky-500" />
            ) : (
              <Folder className="h-4 w-4 text-sky-500" />
            )
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="truncate" title={node.path}>
            {node.name}
          </span>
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
        No files uploaded.
      </div>
    );
  }

  return (
    <div className="space-y-1">{nodes.map((node) => renderNode(node, 0))}</div>
  );
}
