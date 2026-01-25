"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDB, generateId, type HistoryEntry } from "./db";

function shallowEqualRecord(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
) {
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  return Object.entries(a).every(([key, value]) => b[key] === value);
}

function filesEqual(a?: HistoryEntry["files"], b?: HistoryEntry["files"]) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.leftName === b.leftName &&
    a.rightName === b.rightName
  );
}

function entriesEqual(a: HistoryEntry, b: HistoryEntry) {
  return (
    a.hasInput === b.hasInput &&
    a.inputSide === b.inputSide &&
    a.preview === b.preview &&
    shallowEqualRecord(a.inputs, b.inputs) &&
    shallowEqualRecord(a.params, b.params) &&
    filesEqual(a.files, b.files)
  );
}

export function useToolHistory(toolId: string) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const latestEntryRef = useRef<HistoryEntry | null>(null);
  const pendingEntryRef = useRef<HistoryEntry | null>(null);
  const pendingInputRef = useRef<{
    inputs: Record<string, string>;
    params: Record<string, unknown>;
    inputSide?: string;
    preview?: string;
    files?: HistoryEntry["files"];
  } | null>(null);

  // Load entries on mount
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const db = await getDB();
        const allEntries = await db.getAllFromIndex(
          "history",
          "by-tool",
          toolId,
        );
        if (mounted) {
          setEntries(allEntries.sort((a, b) => b.createdAt - a.createdAt));
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load history:", error);
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [toolId]);

  useEffect(() => {
    latestEntryRef.current = entries[0] ?? null;
  }, [entries]);

  // Add new entry (when input text changes)
  const addEntry = useCallback(
    async (
      inputs: Record<string, string>,
      params: Record<string, unknown>,
      inputSide?: string,
      preview?: string,
      files?: HistoryEntry["files"],
      hasInput = true,
    ) => {
      if (loading) {
        pendingInputRef.current = { inputs, params, inputSide, preview, files };
        return null;
      }
      const latest = latestEntryRef.current ?? entries[0];
      const entry: HistoryEntry = {
        id: generateId(),
        toolId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        hasInput,
        inputSide,
        inputs,
        params,
        files,
        preview,
      };

      const pending = pendingEntryRef.current;
      if (pending && entriesEqual(pending, entry)) {
        return pending;
      }
      if (latest && entriesEqual(latest, entry)) {
        return latest;
      }

      try {
        pendingEntryRef.current = entry;
        const db = await getDB();
        await db.put("history", entry);
        setEntries((prev) => [entry, ...prev]);
        pendingEntryRef.current = null;
        latestEntryRef.current = entry;

        // Update recent tools
        await db.put("recentTools", { toolId, lastUsed: Date.now() });

        return entry;
      } catch (error) {
        console.error("Failed to add history entry:", error);
        pendingEntryRef.current = null;
        return null;
      }
    },
    [toolId, entries],
  );

  // Update latest entry params (when params change)
  const updateLatestParams = useCallback(
    async (params: Record<string, unknown>) => {
      if (loading) return;
      if (entries.length === 0) return;

      const latest = entries[0];
      const sameParams =
        Object.keys(latest.params).length === Object.keys(params).length &&
        Object.entries(params).every(
          ([key, value]) => latest.params[key] === value,
        );
      if (sameParams) return;
      const updated: HistoryEntry = {
        ...latest,
        params,
        updatedAt: Date.now(),
      };

      try {
        const db = await getDB();
        await db.put("history", updated);
        setEntries((prev) => [updated, ...prev.slice(1)]);
        latestEntryRef.current = updated;
      } catch (error) {
        console.error("Failed to update history entry:", error);
      }
    },
    [entries],
  );

  const updateLatestEntry = useCallback(
    async (updates: {
      inputs?: Record<string, string>;
      params?: Record<string, unknown>;
      files?: HistoryEntry["files"];
      preview?: string;
      hasInput?: boolean;
    }) => {
      if (loading) return;
      if (entries.length === 0) return;

      const latest = entries[0];
      const nextInputs = updates.inputs
        ? { ...latest.inputs, ...updates.inputs }
        : latest.inputs;
      const nextParams = updates.params ?? latest.params;
      const nextFiles = updates.files
        ? { ...(latest.files ?? {}), ...updates.files }
        : latest.files;
      const nextPreview = updates.preview ?? latest.preview;
      const nextHasInput = updates.hasInput ?? latest.hasInput;
      const sameInputs =
        Object.keys(nextInputs).length === Object.keys(latest.inputs).length &&
        Object.entries(nextInputs).every(
          ([key, value]) => latest.inputs[key] === value,
        );
      const sameParams =
        Object.keys(nextParams).length === Object.keys(latest.params).length &&
        Object.entries(nextParams).every(
          ([key, value]) => latest.params[key] === value,
        );
      const latestFiles = (latest.files ?? {}) as Record<string, unknown>;
      const nextFilesRecord = (nextFiles ?? {}) as Record<string, unknown>;
      const sameFiles =
        Object.keys(nextFilesRecord).length ===
          Object.keys(latestFiles).length &&
        Object.entries(nextFilesRecord).every(
          ([key, value]) => latestFiles[key] === value,
        );
      if (
        sameInputs &&
        sameParams &&
        sameFiles &&
        nextPreview === latest.preview &&
        nextHasInput === latest.hasInput
      )
        return;
      const updated: HistoryEntry = {
        ...latest,
        inputs: nextInputs,
        params: nextParams,
        files: nextFiles,
        preview: nextPreview,
        hasInput: nextHasInput,
        updatedAt: Date.now(),
      };

      try {
        const db = await getDB();
        await db.put("history", updated);
        setEntries((prev) => [updated, ...prev.slice(1)]);
        latestEntryRef.current = updated;
      } catch (error) {
        console.error("Failed to update history entry:", error);
      }
    },
    [entries],
  );

  const upsertInputEntry = useCallback(
    async (
      inputs: Record<string, string>,
      params: Record<string, unknown>,
      inputSide?: string,
      preview?: string,
      files?: HistoryEntry["files"],
    ) => {
      if (loading) {
        pendingInputRef.current = { inputs, params, inputSide, preview, files };
        return null;
      }
      const latest = entries[0];
      if (!latest) {
        return addEntry(inputs, params, inputSide, preview, files, true);
      }
      if (latest.hasInput === false) {
        await updateLatestEntry({
          inputs,
          params,
          preview,
          files,
          hasInput: true,
        });
        return entries[0] ?? null;
      }
      return addEntry(inputs, params, inputSide, preview, files, true);
    },
    [entries, addEntry, updateLatestEntry],
  );

  useEffect(() => {
    if (loading) return;
    if (!pendingInputRef.current) return;
    const pending = pendingInputRef.current;
    pendingInputRef.current = null;
    void upsertInputEntry(
      pending.inputs,
      pending.params,
      pending.inputSide,
      pending.preview,
      pending.files,
    );
  }, [loading, upsertInputEntry]);

  const upsertParams = useCallback(
    async (
      params: Record<string, unknown>,
      mode: "interpretation" | "deferred",
    ) => {
      if (loading) return;
      const latest = entries[0];
      if (!latest) {
        await addEntry({}, params, undefined, undefined, undefined, false);
        return;
      }
      if (latest.hasInput === false) {
        await updateLatestEntry({ params, hasInput: false });
        return;
      }
      if (mode === "deferred") {
        await addEntry({}, params, undefined, undefined, undefined, false);
        return;
      }
      await updateLatestEntry({ params });
    },
    [entries, addEntry, updateLatestEntry],
  );

  // Delete single entry
  const deleteEntry = useCallback(async (id: string) => {
    try {
      const db = await getDB();
      await db.delete("history", id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error("Failed to delete history entry:", error);
    }
  }, []);

  // Clear history for current tool or all
  const clearHistory = useCallback(
    async (scope: "tool" | "all") => {
      try {
        const db = await getDB();

        if (scope === "all") {
          await db.clear("history");
          setEntries([]);
        } else {
          const toolEntries = await db.getAllFromIndex(
            "history",
            "by-tool",
            toolId,
          );
          const tx = db.transaction("history", "readwrite");
          for (const entry of toolEntries) {
            await tx.store.delete(entry.id);
          }
          await tx.done;
          setEntries([]);
        }
      } catch (error) {
        console.error("Failed to clear history:", error);
      }
    },
    [toolId],
  );

  return {
    entries,
    loading,
    addEntry,
    updateLatestParams,
    updateLatestEntry,
    upsertInputEntry,
    upsertParams,
    deleteEntry,
    clearHistory,
  };
}

export function useRecentTools() {
  const [recentTools, setRecentTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const db = await getDB();
        const all = await db.getAll("recentTools");
        const sorted = all
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 10)
          .map((r) => r.toolId);
        if (mounted) {
          setRecentTools(sorted);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load recent tools:", error);
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const recordToolUse = useCallback(async (toolId: string) => {
    try {
      const db = await getDB();
      await db.put("recentTools", { toolId, lastUsed: Date.now() });
      setRecentTools((prev) => {
        const filtered = prev.filter((id) => id !== toolId);
        return [toolId, ...filtered].slice(0, 10);
      });
    } catch (error) {
      console.error("Failed to record tool use:", error);
    }
  }, []);

  return { recentTools, loading, recordToolUse };
}
