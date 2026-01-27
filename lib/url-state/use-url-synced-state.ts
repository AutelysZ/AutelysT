"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import type { z, ZodObject, ZodRawShape } from "zod";
import { getDB, type HistoryEntry } from "@/lib/history/db";
import { decompressState } from "./url-hash-state";

function useSearchParamsString() {
  const getSnapshot = () => {
    if (typeof window === "undefined") return "";
    return window.location.search;
  };

  const getServerSnapshot = () => "";

  const subscribe = (callback: () => void) => {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

async function getLatestHistoryEntry(
  toolId: string,
): Promise<HistoryEntry | null> {
  try {
    const db = await getDB();
    const entries = await db.getAllFromIndex("history", "by-tool", toolId);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.createdAt - a.createdAt)[0];
  } catch {
    return null;
  }
}

export const DEFAULT_URL_SYNC_DEBOUNCE_MS = 300;
const DEFAULT_MAX_URL_PARAM_LENGTH = 2048;

export interface UseUrlSyncedStateOptions<T extends ZodRawShape> {
  schema: ZodObject<T>;
  defaults: z.infer<ZodObject<T>>;
  debounceMs?: number;
  maxUrlParamLength?: number;
  restoreFromHistory?: boolean;
  syncOnHistoryRestore?: boolean;
  shouldSyncParam?: (
    key: keyof z.infer<ZodObject<T>>,
    value: z.infer<ZodObject<T>>[keyof z.infer<ZodObject<T>>],
    state: z.infer<ZodObject<T>>,
  ) => boolean;
  shouldParseParam?: (
    key: keyof z.infer<ZodObject<T>>,
    value: string,
  ) => boolean;
  inputSide?: {
    sideKey: keyof z.infer<ZodObject<T>>;
    inputKeyBySide: Record<string, keyof z.infer<ZodObject<T>>>;
  };
  restoreMissingKeys?: (key: keyof z.infer<ZodObject<T>>) => boolean;
  initialSearch?: string;
}

export function useUrlSyncedState<T extends ZodRawShape>(
  toolId: string,
  options: UseUrlSyncedStateOptions<T>,
) {
  const {
    schema,
    defaults,
    debounceMs = DEFAULT_URL_SYNC_DEBOUNCE_MS,
    maxUrlParamLength = DEFAULT_MAX_URL_PARAM_LENGTH,
    restoreFromHistory = true,
    syncOnHistoryRestore = false,
    shouldSyncParam,
    shouldParseParam,
    inputSide,
    restoreMissingKeys,
    initialSearch,
  } = options;
  const pathname = usePathname();
  const searchString = useSearchParamsString();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingUrlRef = useRef(false);
  const lastUrlRef = useRef<string>("");
  const hasRestoredFromHistoryRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingImmediateRef = useRef(false);
  const pendingStateRef = useRef<z.infer<ZodObject<T>> | null>(null);
  const skipNextUrlUpdateRef = useRef(false);
  const hasInitializedFromUrlRef = useRef(false);
  const [hydrationSource, setHydrationSource] = useState<
    "default" | "url" | "history"
  >("default");
  const normalizedInitialSearch = initialSearch
    ? initialSearch.startsWith("?")
      ? initialSearch
      : `?${initialSearch}`
    : "";

  const shouldParseParamFromUrl = useCallback(
    (key: keyof z.infer<ZodObject<T>>, value: string) =>
      !shouldParseParam || shouldParseParam(key, value),
    [shouldParseParam],
  );

  // Parse URL params
  const parseUrlParams = useCallback(
    (searchStr: string): z.infer<ZodObject<T>> => {
      const params = new URLSearchParams(searchStr);
      const result: Record<string, unknown> = { ...defaults };

      params.forEach((value, key) => {
        if (key in defaults) {
          if (
            !shouldParseParamFromUrl(key as keyof z.infer<ZodObject<T>>, value)
          )
            return;
          const defaultValue = defaults[key as keyof typeof defaults];
          if (typeof defaultValue === "boolean") {
            result[key] = value === "true" || value === "1";
          } else if (typeof defaultValue === "number") {
            const num = Number(value);
            result[key] = isNaN(num) ? defaultValue : num;
          } else {
            result[key] = value;
          }
        }
      });

      try {
        return schema.parse(result);
      } catch {
        return defaults;
      }
    },
    [schema, defaults, shouldParseParamFromUrl],
  );

  // Initialize state from URL on first render only
  const [state, setStateInternal] = useState<z.infer<ZodObject<T>>>(
    () => defaults,
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initial hydration handled in the main effect below
  /* 
  useEffect(() => {
     // Deleted URL query hydration
  }, []);
  */

  const shouldSyncParamWithState = useCallback(
    (
      key: keyof z.infer<ZodObject<T>>,
      value: z.infer<ZodObject<T>>[keyof z.infer<ZodObject<T>>],
      state: z.infer<ZodObject<T>>,
    ) => {
      if (inputSide) {
        const activeSide = String(state[inputSide.sideKey]);
        const inputKey = inputSide.inputKeyBySide[activeSide];
        if (
          inputKey &&
          key !== inputSide.sideKey &&
          key !== inputKey &&
          Object.values(inputSide.inputKeyBySide).includes(key)
        ) {
          return false;
        }
      }
      if (shouldSyncParam && !shouldSyncParam(key, value, state)) {
        return false;
      }
      return true;
    },
    [inputSide, shouldSyncParam],
  );

  const getByteLength = useCallback(
    (value: string) => new TextEncoder().encode(value).length,
    [],
  );

  const oversizeKeys = useMemo(() => {
    const keys: (keyof z.infer<ZodObject<T>>)[] = [];
    for (const [key, value] of Object.entries(state)) {
      const typedKey = key as keyof z.infer<ZodObject<T>>;
      if (
        !shouldSyncParamWithState(
          typedKey,
          value as z.infer<ZodObject<T>>[keyof z.infer<ZodObject<T>>],
          state,
        )
      ) {
        continue;
      }
      if (
        typeof value === "string" &&
        getByteLength(value) > maxUrlParamLength
      ) {
        keys.push(typedKey);
      }
    }
    return keys;
  }, [state, maxUrlParamLength, shouldSyncParamWithState, getByteLength]);

  const updateUrl = useCallback((newState: z.infer<ZodObject<T>>) => {
    // Disabled URL syncing by default as per requirement
    /*
      const params = new URLSearchParams();
       ...
      window.history.replaceState({}, "", newUrl);
      */
    // We still track "lastUrl" to avoid state update loops if we were syncing,
    // but now we just update internal refs if needed or do nothing.
    // Actually, if we're not syncing to URL, we don't need to do anything here.
  }, []);

  const hydrateFromHash = useCallback(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return false;

    const decompressed = decompressState(hash);
    if (decompressed) {
      try {
        const parsed = schema.parse(decompressed);
        setStateInternal(parsed);
        setHydrationSource("url");
        // Clear hash from URL
        window.history.replaceState(null, "", window.location.pathname);
        return true;
      } catch (e) {
        console.error("Failed to parse state from hash", e);
      }
    }
    return false;
  }, [schema]);

  useEffect(() => {
    const onHashChange = () => {
      hydrateFromHash();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [hydrateFromHash]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasInitializedFromUrlRef.current) return;
    hasInitializedFromUrlRef.current = true;

    // 1. Try Hash Hydration (Share URL)
    if (hydrateFromHash()) return;

    // 2. History Hydration
    if (restoreFromHistory) {
      getLatestHistoryEntry(toolId).then((entry) => {
        if (!isMountedRef.current) return;

        if (entry) {
          const restored: Record<string, unknown> = { ...defaults };

          // Restore from params first (structured)
          if (entry.params) {
            for (const [key, value] of Object.entries(entry.params)) {
              if (key in defaults) restored[key] = value;
            }
          }
          // Restore inputs (text updates)
          if (entry.inputs) {
            for (const [key, value] of Object.entries(entry.inputs)) {
              if (key in defaults) restored[key] = value;
            }
          }
          if (entry.params) {
            for (const [key, value] of Object.entries(entry.params)) {
              if (key in defaults) restored[key] = value;
            }
          }

          try {
            const parsed = schema.parse(restored);
            setStateInternal(parsed);
            setHydrationSource("history");
          } catch {}
        }
      });
    }
  }, [toolId, schema, defaults, restoreFromHistory, hydrateFromHash]);

  useEffect(() => {
    // Skip if we caused this URL change or if URL hasn't actually changed
    if (isUpdatingUrlRef.current || searchString === lastUrlRef.current) {
      lastUrlRef.current = searchString;
      isUpdatingUrlRef.current = false;
      return;
    }

    lastUrlRef.current = searchString;
    skipNextUrlUpdateRef.current = true;
    setStateInternal(parseUrlParams(searchString));
  }, [searchString, parseUrlParams]);

  useEffect(() => {
    if (skipNextUrlUpdateRef.current) {
      skipNextUrlUpdateRef.current = false;
      pendingStateRef.current = null;
      pendingImmediateRef.current = false;
      return;
    }

    if (!pendingStateRef.current) return;

    const nextState = pendingStateRef.current;
    const immediate = pendingImmediateRef.current;
    pendingStateRef.current = null;
    pendingImmediateRef.current = false;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (immediate) {
      updateUrl(nextState);
    } else {
      debounceRef.current = setTimeout(() => {
        updateUrl(nextState);
      }, debounceMs);
    }
  }, [state, updateUrl, debounceMs]);

  const setStateSilently = useCallback(
    (
      updater:
        | z.infer<ZodObject<T>>
        | ((prev: z.infer<ZodObject<T>>) => z.infer<ZodObject<T>>),
    ) => {
      skipNextUrlUpdateRef.current = true;
      setStateInternal((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [],
  );

  // Set state with debounced URL update
  const setState = useCallback(
    (
      updater:
        | z.infer<ZodObject<T>>
        | ((prev: z.infer<ZodObject<T>>) => z.infer<ZodObject<T>>),
      immediate = false,
    ) => {
      setStateInternal((prev) => {
        const newState =
          typeof updater === "function" ? updater(prev) : updater;
        pendingImmediateRef.current = immediate;
        pendingStateRef.current = newState;

        return newState;
      });
    },
    [],
  );

  // Set individual param
  const setParam = useCallback(
    <K extends keyof z.infer<ZodObject<T>>>(
      key: K,
      value: z.infer<ZodObject<T>>[K],
      immediate = false,
    ) => {
      setState((prev) => ({ ...prev, [key]: value }), immediate);
    },
    [setState],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const urlParamKeys = useMemo(() => {
    if (typeof window === "undefined") return [] as string[];
    const params = new URLSearchParams(searchString);
    return Array.from(params.entries())
      .filter(
        ([key, value]) =>
          key in defaults &&
          shouldParseParamFromUrl(key as keyof z.infer<ZodObject<T>>, value),
      )
      .map(([key]) => key);
  }, [searchString, defaults, shouldParseParamFromUrl]);

  return {
    state,
    setState,
    setParam,
    resetToDefaults: () => setState(defaults, true),
    setStateSilently,
    oversizeKeys,
    hasUrlParams: urlParamKeys.length > 0,
    urlParamKeys,
    hydrationSource,
  };
}
