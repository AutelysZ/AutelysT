import { openDB } from "idb";

export type CsvFileSnapshot = {
  id: string;
  name: string;
  freezeRows: number;
  freezeCols: number;
  columnWidth: number;
  rowHeight: number;
  columnWidthOverrides: Record<number, number>;
  rowHeightOverrides: Record<number, number>;
  rowCount: number;
  columnCount: number;
};

export type CsvPersistedState = {
  files: CsvFileSnapshot[];
  data: Record<string, string[][]>;
  activeFileId: string;
};

const DB_NAME = "csv-tool";
const STORE_NAME = "state";
const STATE_KEY = "workspace";

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function loadCsvState(): Promise<CsvPersistedState | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await getDb();
    const state = await db.get(STORE_NAME, STATE_KEY);
    return (state as CsvPersistedState) || null;
  } catch {
    return null;
  }
}

export async function saveCsvState(state: CsvPersistedState): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await getDb();
  await db.put(STORE_NAME, state, STATE_KEY);
}

export async function clearCsvState(): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await getDb();
  await db.delete(STORE_NAME, STATE_KEY);
}
