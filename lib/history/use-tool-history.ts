"use client"

import { useCallback, useEffect, useState } from "react"
import { getDB, generateId, type HistoryEntry } from "./db"

export function useToolHistory(toolId: string) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Load entries on mount
  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const db = await getDB()
        const allEntries = await db.getAllFromIndex("history", "by-tool", toolId)
        if (mounted) {
          setEntries(allEntries.sort((a, b) => b.createdAt - a.createdAt))
          setLoading(false)
        }
      } catch (error) {
        console.error("Failed to load history:", error)
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [toolId])

  // Add new entry (when input text changes)
  const addEntry = useCallback(
    async (
      inputs: Record<string, string>,
      params: Record<string, unknown>,
      inputSide?: "left" | "right",
      preview?: string,
    ) => {
      const entry: HistoryEntry = {
        id: generateId(),
        toolId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        inputSide,
        inputs,
        params,
        preview,
      }

      try {
        const db = await getDB()
        await db.put("history", entry)
        setEntries((prev) => [entry, ...prev])

        // Update recent tools
        await db.put("recentTools", { toolId, lastUsed: Date.now() })

        return entry
      } catch (error) {
        console.error("Failed to add history entry:", error)
        return null
      }
    },
    [toolId],
  )

  // Update latest entry params (when params change)
  const updateLatestParams = useCallback(
    async (params: Record<string, unknown>) => {
      if (entries.length === 0) return

      const latest = entries[0]
      const updated: HistoryEntry = {
        ...latest,
        params,
        updatedAt: Date.now(),
      }

      try {
        const db = await getDB()
        await db.put("history", updated)
        setEntries((prev) => [updated, ...prev.slice(1)])
      } catch (error) {
        console.error("Failed to update history entry:", error)
      }
    },
    [entries],
  )

  // Delete single entry
  const deleteEntry = useCallback(async (id: string) => {
    try {
      const db = await getDB()
      await db.delete("history", id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (error) {
      console.error("Failed to delete history entry:", error)
    }
  }, [])

  // Clear history for current tool or all
  const clearHistory = useCallback(
    async (scope: "tool" | "all") => {
      try {
        const db = await getDB()

        if (scope === "all") {
          await db.clear("history")
          setEntries([])
        } else {
          const toolEntries = await db.getAllFromIndex("history", "by-tool", toolId)
          const tx = db.transaction("history", "readwrite")
          for (const entry of toolEntries) {
            await tx.store.delete(entry.id)
          }
          await tx.done
          setEntries([])
        }
      } catch (error) {
        console.error("Failed to clear history:", error)
      }
    },
    [toolId],
  )

  return {
    entries,
    loading,
    addEntry,
    updateLatestParams,
    deleteEntry,
    clearHistory,
  }
}

export function useRecentTools() {
  const [recentTools, setRecentTools] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const db = await getDB()
        const all = await db.getAll("recentTools")
        const sorted = all
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 10)
          .map((r) => r.toolId)
        if (mounted) {
          setRecentTools(sorted)
          setLoading(false)
        }
      } catch (error) {
        console.error("Failed to load recent tools:", error)
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const recordToolUse = useCallback(async (toolId: string) => {
    try {
      const db = await getDB()
      await db.put("recentTools", { toolId, lastUsed: Date.now() })
      setRecentTools((prev) => {
        const filtered = prev.filter((id) => id !== toolId)
        return [toolId, ...filtered].slice(0, 10)
      })
    } catch (error) {
      console.error("Failed to record tool use:", error)
    }
  }, [])

  return { recentTools, loading, recordToolUse }
}
