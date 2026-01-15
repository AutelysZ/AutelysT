export interface TextDiffLine {
  type: "added" | "removed" | "unchanged" | "context-separator"
  lineNumber?: { left?: number; right?: number }
  content: string
  charDiff?: { type: "added" | "removed" | "unchanged"; text: string }[]
}

export interface DiffHunk {
  startLeft: number
  startRight: number
  lines: TextDiffLine[]
}

export function computeTextDiff(text1: string, text2: string): TextDiffLine[] {
  const lines1 = text1.split("\n")
  const lines2 = text2.split("\n")

  const result: TextDiffLine[] = []

  // Simple LCS-based diff
  const lcs = computeLCS(lines1, lines2)

  let i = 0
  let j = 0
  let leftLine = 1
  let rightLine = 1

  for (const match of lcs) {
    // Add removed lines before this match
    while (i < match.i) {
      result.push({
        type: "removed",
        lineNumber: { left: leftLine++ },
        content: lines1[i++],
      })
    }

    // Add added lines before this match
    while (j < match.j) {
      result.push({
        type: "added",
        lineNumber: { right: rightLine++ },
        content: lines2[j++],
      })
    }

    // Add the matching line
    result.push({
      type: "unchanged",
      lineNumber: { left: leftLine++, right: rightLine++ },
      content: lines1[i],
    })
    i++
    j++
  }

  // Add remaining removed lines
  while (i < lines1.length) {
    result.push({
      type: "removed",
      lineNumber: { left: leftLine++ },
      content: lines1[i++],
    })
  }

  // Add remaining added lines
  while (j < lines2.length) {
    result.push({
      type: "added",
      lineNumber: { right: rightLine++ },
      content: lines2[j++],
    })
  }

  return addCharacterDiff(result)
}

function addCharacterDiff(lines: TextDiffLine[]): TextDiffLine[] {
  const result: TextDiffLine[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Look for adjacent removed + added pairs (modified lines)
    if (line.type === "removed" && i + 1 < lines.length && lines[i + 1].type === "added") {
      const removed = line
      const added = lines[i + 1]

      // Compute character-level diff
      removed.charDiff = computeCharDiff(removed.content, added.content, "removed")
      added.charDiff = computeCharDiff(removed.content, added.content, "added")

      result.push(removed)
      result.push(added)
      i += 2
    } else {
      result.push(line)
      i++
    }
  }

  return result
}

function computeCharDiff(
  str1: string,
  str2: string,
  forSide: "removed" | "added",
): { type: "added" | "removed" | "unchanged"; text: string }[] {
  const chars1 = str1.split("")
  const chars2 = str2.split("")
  const lcs = computeLCS(chars1, chars2)

  const result: { type: "added" | "removed" | "unchanged"; text: string }[] = []

  let i1 = 0
  let i2 = 0

  for (const match of lcs) {
    if (forSide === "removed") {
      // For removed line: show what was removed (from str1) and unchanged
      while (i1 < match.i) {
        const last = result[result.length - 1]
        if (last && last.type === "removed") {
          last.text += chars1[i1]
        } else {
          result.push({ type: "removed", text: chars1[i1] })
        }
        i1++
      }
      i2 = match.j
    } else {
      // For added line: show what was added (from str2) and unchanged
      while (i2 < match.j) {
        const last = result[result.length - 1]
        if (last && last.type === "added") {
          last.text += chars2[i2]
        } else {
          result.push({ type: "added", text: chars2[i2] })
        }
        i2++
      }
      i1 = match.i
    }

    // Add unchanged character
    const last = result[result.length - 1]
    if (last && last.type === "unchanged") {
      last.text += chars1[match.i]
    } else {
      result.push({ type: "unchanged", text: chars1[match.i] })
    }
    i1++
    i2++
  }

  // Add remaining characters
  if (forSide === "removed") {
    while (i1 < chars1.length) {
      const last = result[result.length - 1]
      if (last && last.type === "removed") {
        last.text += chars1[i1]
      } else {
        result.push({ type: "removed", text: chars1[i1] })
      }
      i1++
    }
  } else {
    while (i2 < chars2.length) {
      const last = result[result.length - 1]
      if (last && last.type === "added") {
        last.text += chars2[i2]
      } else {
        result.push({ type: "added", text: chars2[i2] })
      }
      i2++
    }
  }

  return result
}

export function groupIntoHunks(diff: TextDiffLine[], contextLines = 3): DiffHunk[] {
  const hunks: DiffHunk[] = []

  // Find changed regions
  const changedIndices: number[] = []
  diff.forEach((line, idx) => {
    if (line.type !== "unchanged") {
      changedIndices.push(idx)
    }
  })

  if (changedIndices.length === 0) return hunks

  // Group changes that are close together
  let currentHunk: { start: number; end: number } | null = null
  const groups: { start: number; end: number }[] = []

  for (const idx of changedIndices) {
    if (!currentHunk) {
      currentHunk = { start: idx, end: idx }
    } else if (idx - currentHunk.end <= contextLines * 2 + 1) {
      currentHunk.end = idx
    } else {
      groups.push(currentHunk)
      currentHunk = { start: idx, end: idx }
    }
  }
  if (currentHunk) groups.push(currentHunk)

  // Build hunks with context
  for (const group of groups) {
    const start = Math.max(0, group.start - contextLines)
    const end = Math.min(diff.length - 1, group.end + contextLines)

    const hunkLines = diff.slice(start, end + 1)

    // Find starting line numbers
    let startLeft = 1
    let startRight = 1
    for (let i = 0; i < start; i++) {
      if (diff[i].lineNumber?.left) startLeft = diff[i].lineNumber!.left! + 1
      if (diff[i].lineNumber?.right) startRight = diff[i].lineNumber!.right! + 1
    }

    hunks.push({
      startLeft,
      startRight,
      lines: hunkLines,
    })
  }

  return hunks
}

interface Match {
  i: number
  j: number
}

function computeLCS<T>(arr1: T[], arr2: T[]): Match[] {
  const m = arr1.length
  const n = arr2.length

  // DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find matches
  const matches: Match[] = []
  let i = m
  let j = n

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      matches.unshift({ i: i - 1, j: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return matches
}

export function getDiffStats(diff: TextDiffLine[]): { added: number; removed: number; unchanged: number } {
  return diff.reduce(
    (stats, line) => {
      if (line.type === "added") stats.added++
      else if (line.type === "removed") stats.removed++
      else if (line.type === "unchanged") stats.unchanged++
      return stats
    },
    { added: 0, removed: 0, unchanged: 0 },
  )
}
