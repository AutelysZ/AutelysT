import * as semver from "semver";

export interface SemverCompareResult {
  validA: boolean;
  validB: boolean;
  comparison: -1 | 0 | 1 | null;
  diff: semver.ReleaseType | null;
}

export interface SemverRangeResult {
  validVersion: boolean;
  validRange: boolean;
  satisfies: boolean;
}

export interface SemverSortResult {
  valid: string[];
  invalid: string[];
}

export function compareSemver(a: string, b: string): SemverCompareResult {
  const cleanA = semver.valid(a.trim(), { loose: true });
  const cleanB = semver.valid(b.trim(), { loose: true });
  if (!cleanA || !cleanB) {
    return {
      validA: Boolean(cleanA),
      validB: Boolean(cleanB),
      comparison: null,
      diff: null,
    };
  }

  return {
    validA: true,
    validB: true,
    comparison: semver.compare(cleanA, cleanB),
    diff: semver.diff(cleanA, cleanB),
  };
}

export function evaluateSemverRange(
  version: string,
  range: string,
): SemverRangeResult {
  const cleanVersion = semver.valid(version.trim(), { loose: true });
  const validRange = semver.validRange(range.trim(), { loose: true });
  return {
    validVersion: Boolean(cleanVersion),
    validRange: Boolean(validRange),
    satisfies:
      cleanVersion && validRange
        ? semver.satisfies(cleanVersion, validRange)
        : false,
  };
}

export function sortSemverLines(
  text: string,
  descending = false,
): SemverSortResult {
  const raw = text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const item of raw) {
    const parsed = semver.valid(item, { loose: true });
    if (parsed) {
      valid.push(parsed);
    } else {
      invalid.push(item);
    }
  }

  const uniqueValid = Array.from(new Set(valid));
  uniqueValid.sort((left, right) =>
    descending ? semver.rcompare(left, right) : semver.compare(left, right),
  );

  return {
    valid: uniqueValid,
    invalid,
  };
}

export function incrementSemver(
  version: string,
  release: semver.ReleaseType,
  preid?: string,
): string | null {
  const cleanVersion = semver.valid(version.trim(), { loose: true });
  if (!cleanVersion) {
    return null;
  }
  return semver.inc(cleanVersion, release, preid ?? undefined);
}
