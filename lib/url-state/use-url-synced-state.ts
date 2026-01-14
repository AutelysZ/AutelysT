"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import type { z, ZodObject, ZodRawShape } from "zod"
import { getDB, type HistoryEntry } from "@/lib/history/db"

function useSearchParamsString() {
  const getSnapshot = () => {
    if (typeof window === "undefined") return ""
    return window.location.search
  }

  const getServerSnapshot = () => ""

  const subscribe = (callback: () => void) => {
    window.addEventListener("popstate", callback)
    return () => window.removeEventListener("popstate", callback)
  }

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

async function getLatestHistoryEntry(toolId: string): Promise<HistoryEntry | null> {
  try {
    const db = await getDB()
    const entries = await db.getAllFromIndex("history", "by-tool", toolId)
    if (entries.length === 0) return null
    return entries.sort((a, b) => b.createdAt - a.createdAt)[0]
  } catch {
    return null
  }
}

export interface UseUrlSyncedStateOptions<T extends ZodRawShape> {
  schema: ZodObject<T>
  defaults: z.infer<ZodObject<T>>
  debounceMs?: number
}

export function useUrlSyncedState<T extends ZodRawShape>(toolId: string, options: UseUrlSyncedStateOptions<T>) {
  const { schema, defaults, debounceMs = 300 } = options
  const pathname = usePathname()
  const searchString = useSearchParamsString()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const isUpdatingUrlRef = useRef(false)
  const lastUrlRef = useRef<string>("")
  const hasRestoredFromHistoryRef = useRef(false)
  const isMountedRef = useRef(true)

  // Parse URL params
  const parseUrlParams = useCallback(
    (searchStr: string): z.infer<ZodObject<T>> => {
      const params = new URLSearchParams(searchStr)
      const result: Record<string, unknown> = { ...defaults }

      params.forEach((value, key) => {
        if (key in defaults) {
          const defaultValue = defaults[key as keyof typeof defaults]
          if (typeof defaultValue === "boolean") {
            result[key] = value === "true" || value === "1"
          } else if (typeof defaultValue === "number") {
            const num = Number(value)
            result[key] = isNaN(num) ? defaultValue : num
          } else {
            result[key] = value
          }
        }
      })

      try {
        return schema.parse(result)
      } catch {
        return defaults
      }
    },
    [schema, defaults],
  )

  // Initialize state from URL on first render only
  const [state, setStateInternal] = useState<z.infer<ZodObject<T>>>(() => {
    if (typeof window !== "undefined") {
      lastUrlRef.current = window.location.search
      return parseUrlParams(window.location.search)
    }
    return defaults
  })

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (hasRestoredFromHistoryRef.current) return

    // Check if URL has any meaningful params (excluding defaults)
    const currentParams = new URLSearchParams(window.location.search)
    const hasUrlParams = Array.from(currentParams.keys()).some((key) => key in defaults)

    if (!hasUrlParams) {
      hasRestoredFromHistoryRef.current = true
      getLatestHistoryEntry(toolId).then((entry) => {
        if (!isMountedRef.current) return
        if (entry) {
          const restored: Record<string, unknown> = { ...defaults }

          // Restore inputs
          if (entry.inputs) {
            for (const [key, value] of Object.entries(entry.inputs)) {
              if (key in defaults) {
                restored[key] = value
              }
            }
          }

          // Restore params
          if (entry.params) {
            for (const [key, value] of Object.entries(entry.params)) {
              if (key in defaults) {
                restored[key] = value
              }
            }
          }

          try {
            const parsed = schema.parse(restored)
            setStateInternal(parsed)
          } catch {
            // Ignore parse errors
          }
        }
      })
    } else {
      hasRestoredFromHistoryRef.current = true
    }
  }, [toolId, defaults, schema])

  useEffect(() => {
    // Skip if we caused this URL change or if URL hasn't actually changed
    if (isUpdatingUrlRef.current || searchString === lastUrlRef.current) {
      isUpdatingUrlRef.current = false
      return
    }

    lastUrlRef.current = searchString
    setStateInternal(parseUrlParams(searchString))
  }, [searchString, parseUrlParams])

  // Update URL when state changes
  const updateUrl = useCallback(
    (newState: z.infer<ZodObject<T>>) => {
      const params = new URLSearchParams()

      for (const [key, value] of Object.entries(newState)) {
        if (value !== defaults[key as keyof typeof defaults] && value !== null && value !== undefined) {
          params.set(key, String(value))
        }
      }

      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname

      isUpdatingUrlRef.current = true
      lastUrlRef.current = queryString ? `?${queryString}` : ""
      window.history.replaceState({}, "", newUrl)
    },
    [pathname, defaults],
  )

  // Set state with debounced URL update
  const setState = useCallback(
    (updater: z.infer<ZodObject<T>> | ((prev: z.infer<ZodObject<T>>) => z.infer<ZodObject<T>>), immediate = false) => {
      setStateInternal((prev) => {
        const newState = typeof updater === "function" ? updater(prev) : updater

        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }

        if (immediate) {
          updateUrl(newState)
        } else {
          debounceRef.current = setTimeout(() => {
            updateUrl(newState)
          }, debounceMs)
        }

        return newState
      })
    },
    [updateUrl, debounceMs],
  )

  // Set individual param
  const setParam = useCallback(
    <K extends keyof z.infer<ZodObject<T>>>(key: K, value: z.infer<ZodObject<T>>[K], immediate = false) => {
      setState((prev) => ({ ...prev, [key]: value }), immediate)
    },
    [setState],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    state,
    setState,
    setParam,
    resetToDefaults: () => setState(defaults, true),
  }
}
