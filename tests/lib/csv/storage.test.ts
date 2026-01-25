import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { store, openDBMock } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const openDBMock = vi.fn(async () => ({
    get: async (_store: string, key: string) => store.get(key),
    put: async (_store: string, value: unknown, key: string) => {
      store.set(key, value);
    },
    delete: async (_store: string, key: string) => {
      store.delete(key);
    },
  }));
  return { store, openDBMock };
});

vi.mock("idb", () => ({ openDB: openDBMock }));

import {
  loadCsvState,
  saveCsvState,
  clearCsvState,
} from "../../../lib/csv/storage";

const sampleState = {
  files: [
    {
      id: "file-1",
      name: "demo.csv",
      freezeRows: 0,
      freezeCols: 0,
      columnWidth: 120,
      rowHeight: 32,
      columnWidthOverrides: { 1: 180 },
      rowHeightOverrides: { 0: 40 },
      rowCount: 2,
      columnCount: 3,
    },
  ],
  data: {
    "file-1": [
      ["a", "b", "c"],
      ["1", "2", "3"],
    ],
  },
  activeFileId: "file-1",
};

describe("csv storage", () => {
  beforeEach(() => {
    store.clear();
    openDBMock.mockClear();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("skips storage when window is undefined", async () => {
    delete (globalThis as { window?: unknown }).window;
    const result = await loadCsvState();
    expect(result).toBeNull();
    expect(openDBMock).not.toHaveBeenCalled();
  });

  it("saves and loads state", async () => {
    (globalThis as { window?: unknown }).window = {};
    await saveCsvState(sampleState);
    const loaded = await loadCsvState();
    expect(loaded).toEqual(sampleState);
  });

  it("clears stored state", async () => {
    (globalThis as { window?: unknown }).window = {};
    await saveCsvState(sampleState);
    await clearCsvState();
    const loaded = await loadCsvState();
    expect(loaded).toBeNull();
  });
});
