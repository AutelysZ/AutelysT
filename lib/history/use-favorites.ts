"use client"

import { useCallback, useEffect, useState } from "react"
import { getDB } from "./db"

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadFavorites = useCallback(async () => {
    try {
      const db = await getDB()
      const all = await db.getAll("favorites")
      const sorted = all.sort((a, b) => a.addedAt - b.addedAt).map((f) => f.toolId)
      setFavorites(sorted)
      setLoading(false)
    } catch (error) {
      console.error("Failed to load favorites:", error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const db = await getDB()
        const all = await db.getAll("favorites")
        const sorted = all.sort((a, b) => a.addedAt - b.addedAt).map((f) => f.toolId)
        if (mounted) {
          setFavorites(sorted)
          setLoading(false)
        }
      } catch (error) {
        console.error("Failed to load favorites:", error)
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => {
      loadFavorites()
    }
    window.addEventListener("favorites:updated", handler)
    return () => {
      window.removeEventListener("favorites:updated", handler)
    }
  }, [loadFavorites])

  const toggleFavorite = useCallback(async (toolId: string) => {
    try {
      const db = await getDB()
      const existing = await db.get("favorites", toolId)

      if (existing) {
        await db.delete("favorites", toolId)
        setFavorites((prev) => prev.filter((id) => id !== toolId))
      } else {
        await db.put("favorites", { toolId, addedAt: Date.now() })
        setFavorites((prev) => [...prev, toolId])
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("favorites:updated"))
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error)
    }
  }, [])

  const isFavorite = useCallback((toolId: string) => favorites.includes(toolId), [favorites])

  return { favorites, loading, toggleFavorite, isFavorite }
}
