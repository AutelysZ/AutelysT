"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface HistoryEntry {
  id: string;
  toolId: string;
  createdAt: number;
  updatedAt: number;
  hasInput?: boolean;
  inputSide?: string;
  inputs: Record<string, string>;
  params: Record<string, unknown>;
  files?: {
    left?: Blob;
    right?: Blob;
    leftName?: string;
    rightName?: string;
  };
  preview?: string;
}

interface ToolHistoryDB extends DBSchema {
  history: {
    key: string;
    value: HistoryEntry;
    indexes: {
      "by-tool": string;
      "by-date": number;
    };
  };
  recentTools: {
    key: string;
    value: {
      toolId: string;
      lastUsed: number;
    };
  };
  favorites: {
    key: string;
    value: {
      toolId: string;
      addedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ToolHistoryDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ToolHistoryDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available on server"));
  }

  if (!dbPromise) {
    dbPromise = openDB<ToolHistoryDB>("autelyst-tools", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const historyStore = db.createObjectStore("history", {
            keyPath: "id",
          });
          historyStore.createIndex("by-tool", "toolId");
          historyStore.createIndex("by-date", "createdAt");

          db.createObjectStore("recentTools", { keyPath: "toolId" });
        }
        if (oldVersion < 2) {
          db.createObjectStore("favorites", { keyPath: "toolId" });
        }
      },
    });
  }
  return dbPromise;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
