import parseContentSecurityPolicy from "content-security-policy-parser"
import { getCSP } from "csp-header"
import type { CspDirective } from "./csp-builder-types"

export const DEFAULT_CSP_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"

const DIRECTIVE_SEPARATOR = ";"

export function parseDirectiveValues(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  return trimmed.split(/\s+/).filter(Boolean)
}

export function formatDirectiveValues(values: string[]): string {
  if (!values.length) return ""
  return values.join(" ")
}

function parseSegments(policy: string): CspDirective[] {
  return policy
    .split(DIRECTIVE_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [name, ...rest] = segment.split(/\s+/)
      return {
        name: name ?? "",
        values: rest,
      }
    })
    .filter((directive) => directive.name)
}

export function parseCspPolicy(policy: string): { directives: CspDirective[]; error: string | null } {
  const trimmed = policy.trim()
  if (!trimmed) {
    return { directives: [], error: null }
  }

  let error: string | null = null
  let directives: CspDirective[] = []
  try {
    const parsed = parseContentSecurityPolicy(policy)
    directives = Array.from(parsed.entries()).map(([name, values]) => ({
      name,
      values,
    }))
  } catch (err) {
    console.error("CSP parse failed", err)
    error = err instanceof Error ? err.message : "Failed to parse CSP policy"
    directives = parseSegments(policy)
  }

  return {
    directives,
    error,
  }
}

function normalizeCspString(value: string): string {
  return value.replace(/\s+;/g, ";").replace(/\s{2,}/g, " ").trim()
}

export function buildCspPolicy(directives: CspDirective[]): string {
  const directiveMap: Record<string, string[]> = {}

  for (const directive of directives) {
    const name = directive.name.trim()
    if (!name) continue

    if (!directiveMap[name]) {
      directiveMap[name] = []
    }

    const values = directive.values.map((value) => value.trim()).filter(Boolean)
    if (values.length) {
      directiveMap[name].push(...values)
    }
  }

  try {
    return normalizeCspString(getCSP({ directives: directiveMap }))
  } catch (err) {
    console.error("CSP build failed", err)
    return ""
  }
}
