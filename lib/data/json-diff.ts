export interface DiffChange {
  type: "added" | "removed" | "modified" | "unchanged";
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export function compareJSON(
  obj1: unknown,
  obj2: unknown,
  path = "",
): DiffChange[] {
  const changes: DiffChange[] = [];

  // Handle null/undefined
  if (obj1 === null || obj1 === undefined) {
    if (obj2 !== null && obj2 !== undefined) {
      changes.push({ type: "added", path: path || "(root)", newValue: obj2 });
    }
    return changes;
  }

  if (obj2 === null || obj2 === undefined) {
    changes.push({ type: "removed", path: path || "(root)", oldValue: obj1 });
    return changes;
  }

  // Handle type mismatch
  if (
    typeof obj1 !== typeof obj2 ||
    Array.isArray(obj1) !== Array.isArray(obj2)
  ) {
    changes.push({
      type: "modified",
      path: path || "(root)",
      oldValue: obj1,
      newValue: obj2,
    });
    return changes;
  }

  // Handle primitives
  if (typeof obj1 !== "object") {
    if (obj1 !== obj2) {
      changes.push({
        type: "modified",
        path: path || "(root)",
        oldValue: obj1,
        newValue: obj2,
      });
    }
    return changes;
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= obj1.length) {
        changes.push({ type: "added", path: itemPath, newValue: obj2[i] });
      } else if (i >= obj2.length) {
        changes.push({ type: "removed", path: itemPath, oldValue: obj1[i] });
      } else {
        changes.push(...compareJSON(obj1[i], obj2[i], itemPath));
      }
    }
    return changes;
  }

  // Handle objects
  const allKeys = new Set([
    ...Object.keys(obj1 as object),
    ...Object.keys(obj2 as object),
  ]);
  for (const key of allKeys) {
    const keyPath = path ? `${path}.${key}` : key;
    const val1 = (obj1 as Record<string, unknown>)[key];
    const val2 = (obj2 as Record<string, unknown>)[key];

    if (!(key in (obj1 as object))) {
      changes.push({ type: "added", path: keyPath, newValue: val2 });
    } else if (!(key in (obj2 as object))) {
      changes.push({ type: "removed", path: keyPath, oldValue: val1 });
    } else {
      changes.push(...compareJSON(val1, val2, keyPath));
    }
  }

  return changes;
}

export function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
