"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import type { z, ZodObject, ZodRawShape } from "zod"

export interface UseUrlSyncedStateOptions<T extends ZodRawShape> {
  schema: ZodObject<T>
  defaults: z.infer<ZodObject<T>>
  debounceMs?: number
}

export function useUrlSyncedState<T extends ZodRawShape>(toolId: string, options: UseUrlSyncedStateOptions<T>) {
  const { schema, defaults, debounceMs = 300 } = options
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  // Parse URL params on mount and popstate
  const parseUrlParams = useCallback((): z.infer<ZodObject<T>> => {
    const params: Record<string, unknown> = { ...defaults }

    searchParams.forEach((value, key) => {
      if (key in defaults) {
        const defaultValue = defaults[key as keyof typeof defaults]
        if (typeof defaultValue === "boolean") {
          params[key] = value === "true" || value === "1"
        } else if (typeof defaultValue === "number") {
          const num = Number(value)
          params[key] = isNaN(num) ? defaultValue : num
        } else {
          params[key] = value
        }
      }
    })

    try {
      return schema.parse(params)
    } catch {
      return defaults
    }
  }, [searchParams, schema, defaults])

  const [state, setStateInternal] = useState<z.infer<ZodObject<T>>>(() => parseUrlParams())

  // Sync URL to state on popstate
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }
    setStateInternal(parseUrlParams())
  }, [searchParams, parseUrlParams])

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

      window.history.pushState({}, "", newUrl)
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
