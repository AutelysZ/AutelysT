// Regex Engine - Testing and Flavor Conversion

export interface ParsedPattern {
  raw: string;
  pattern: string;
  flags: string;
  inlineFlags: string;
  isValid: boolean;
  error?: string;
}

export type RegexFlavor =
  | "ecmascript"
  | "re2"
  | "pcre"
  | "python"
  | "java"
  | "dotnet"
  | "go"
  | "rust"
  | "bre"
  | "ere";

export interface RegexMatch {
  index: number;
  length: number;
  value: string;
  groups: { name?: string; index: number; value: string | undefined }[];
}

export interface RegexTestResult {
  isValid: boolean;
  error?: string;
  matches: RegexMatch[];
  executionTime: number;
}

export interface FlavorInfo {
  id: RegexFlavor;
  name: string;
  description: string;
  flags: string[];
  features: string[];
  unsupported: string[];
}

export const FLAVOR_INFO: Record<RegexFlavor, FlavorInfo> = {
  ecmascript: {
    id: "ecmascript",
    name: "ECMAScript (JavaScript)",
    description: "JavaScript/TypeScript regex engine",
    flags: ["g", "i", "m", "s", "u", "v", "y", "d"],
    features: [
      "Named groups (?<name>...)",
      "Lookahead (?=...) (?!...)",
      "Lookbehind (?<=...) (?<!...)",
      "Unicode properties \\p{...}",
      "Unicode sets [\\p{...}--\\p{...}]",
      "Backreferences \\1, \\k<name>",
      "Non-capturing groups (?:...)",
    ],
    unsupported: [
      "Atomic groups (?>...)",
      "Possessive quantifiers ++, *+",
      "Conditionals (?(cond)then|else)",
      "Recursion (?R)",
      "Subroutines (?&name)",
    ],
  },
  re2: {
    id: "re2",
    name: "RE2 (Google)",
    description: "Google's safe, efficient regex engine (Go, Python re2)",
    flags: ["i", "m", "s", "U"],
    features: [
      "Named groups (?P<name>...)",
      "Non-capturing groups (?:...)",
      "Character classes",
      "Unicode support",
      "Submatch extraction",
    ],
    unsupported: [
      "Backreferences",
      "Lookahead/lookbehind",
      "Atomic groups",
      "Possessive quantifiers",
      "Recursion",
    ],
  },
  pcre: {
    id: "pcre",
    name: "PCRE",
    description: "Perl Compatible Regular Expressions",
    flags: ["g", "i", "m", "s", "x", "U", "J", "A", "D"],
    features: [
      "Named groups (?<name>...) or (?P<name>...)",
      "Lookahead/lookbehind",
      "Atomic groups (?>...)",
      "Possessive quantifiers ++, *+, ?+",
      "Conditionals (?(cond)then|else)",
      "Recursion (?R), (?0)",
      "Subroutines (?&name), (?1)",
      "Unicode properties \\p{...}",
      "Comments (?#...)",
      "Branch reset (?|...)",
    ],
    unsupported: [],
  },
  python: {
    id: "python",
    name: "Python (re)",
    description: "Python's built-in re module",
    flags: ["g", "i", "m", "s", "x", "a", "L", "u"],
    features: [
      "Named groups (?P<name>...)",
      "Lookahead/lookbehind",
      "Non-capturing groups (?:...)",
      "Backreferences \\1, (?P=name)",
      "Comments (?#...)",
      "Conditional (?P=name)...|...",
    ],
    unsupported: [
      "Atomic groups",
      "Possessive quantifiers",
      "Recursion",
      "Subroutines",
    ],
  },
  java: {
    id: "java",
    name: "Java",
    description: "Java's java.util.regex",
    flags: ["g", "i", "m", "s", "x", "u", "d", "U"],
    features: [
      "Named groups (?<name>...)",
      "Lookahead/lookbehind",
      "Atomic groups (?>...)",
      "Possessive quantifiers ++, *+, ?+",
      "Unicode properties \\p{...}",
      "Backreferences \\1, \\k<name>",
    ],
    unsupported: ["Recursion", "Subroutines", "Conditionals", "Branch reset"],
  },
  dotnet: {
    id: "dotnet",
    name: ".NET",
    description: "C#/.NET System.Text.RegularExpressions",
    flags: ["g", "i", "m", "s", "x", "n"],
    features: [
      "Named groups (?<name>...) or (?'name'...)",
      "Lookahead/lookbehind",
      "Atomic groups (?>...)",
      "Balancing groups (?<name1-name2>...)",
      "Conditionals (?(name)then|else)",
      "Unicode categories \\p{...}",
      "Right-to-left matching",
    ],
    unsupported: ["Possessive quantifiers", "Recursion", "Subroutines"],
  },
  go: {
    id: "go",
    name: "Go (regexp)",
    description: "Go's RE2-based regexp package",
    flags: ["i", "m", "s", "U"],
    features: [
      "Named groups (?P<name>...)",
      "Non-capturing groups (?:...)",
      "Character classes",
      "Unicode support",
      "Leftmost-longest matching",
    ],
    unsupported: [
      "Backreferences",
      "Lookahead/lookbehind",
      "Atomic groups",
      "Possessive quantifiers",
      "Recursion",
    ],
  },
  rust: {
    id: "rust",
    name: "Rust (regex)",
    description: "Rust's regex crate",
    flags: ["i", "m", "s", "x", "u", "U"],
    features: [
      "Named groups (?P<name>...) or (?<name>...)",
      "Non-capturing groups (?:...)",
      "Unicode properties \\p{...}",
      "Character classes",
    ],
    unsupported: [
      "Backreferences",
      "Lookahead/lookbehind",
      "Atomic groups",
      "Possessive quantifiers",
      "Recursion",
    ],
  },
  bre: {
    id: "bre",
    name: "BRE (Basic)",
    description: "POSIX Basic Regular Expressions (grep, sed)",
    flags: ["i"],
    features: [
      "Character classes [...]",
      "Backreferences \\1-\\9",
      "Beginning/end anchors ^$",
      "Any character .",
    ],
    unsupported: [
      "Alternation | (use \\|)",
      "One or more + (use \\+)",
      "Zero or one ? (use \\?)",
      "Grouping () (use \\(\\))",
      "Named groups",
      "Lookahead/lookbehind",
      "Non-greedy quantifiers",
    ],
  },
  ere: {
    id: "ere",
    name: "ERE (Extended)",
    description: "POSIX Extended Regular Expressions (egrep, awk)",
    flags: ["i"],
    features: [
      "Character classes [...]",
      "Alternation |",
      "Grouping (...)",
      "Quantifiers +, ?, {n,m}",
      "Beginning/end anchors ^$",
    ],
    unsupported: [
      "Backreferences (some implementations)",
      "Named groups",
      "Lookahead/lookbehind",
      "Non-greedy quantifiers",
      "Unicode properties",
    ],
  },
};

// Syntax conversion mappings
interface ConversionRule {
  from: RegExp;
  to: string | ((match: string, ...args: string[]) => string);
  description: string;
}

// Test regex with JavaScript engine
export function testRegex(
  pattern: string,
  flags: string,
  testString: string,
): RegexTestResult {
  const startTime = performance.now();

  try {
    const regex = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];

    // Helper to extract groups from a match
    const extractGroups = (match: RegExpExecArray): RegexMatch["groups"] => {
      const groups: RegexMatch["groups"] = [];

      // Extract all numbered groups (including unmatched ones)
      for (let i = 1; i < match.length; i++) {
        groups.push({
          index: i,
          value: match[i], // Can be undefined for unmatched groups
        });
      }

      // Add named group names if available
      if (match.groups) {
        for (const [name, value] of Object.entries(match.groups)) {
          // Find the group with matching value (or undefined for unmatched)
          const groupIndex = groups.findIndex(
            (g) => g.value === value && !g.name,
          );
          if (groupIndex !== -1) {
            groups[groupIndex].name = name;
          }
        }
      }

      return groups;
    };

    if (flags.includes("g")) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(testString)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          value: match[0],
          groups: extractGroups(match),
        });

        // Prevent infinite loop for zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } else {
      const match = regex.exec(testString);
      if (match) {
        matches.push({
          index: match.index,
          length: match[0].length,
          value: match[0],
          groups: extractGroups(match),
        });
      }
    }

    return {
      isValid: true,
      matches,
      executionTime: performance.now() - startTime,
    };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : "Invalid regex",
      matches: [],
      executionTime: performance.now() - startTime,
    };
  }
}

// Conversion rules between flavors
const CONVERSION_RULES: Partial<
  Record<RegexFlavor, Partial<Record<RegexFlavor, ConversionRule[]>>>
> = {
  ecmascript: {
    python: [
      {
        from: /\(\?<(\w+)>/g,
        to: "(?P<$1>",
        description: "Named group syntax",
      },
      {
        from: /\\k<(\w+)>/g,
        to: "(?P=$1)",
        description: "Named backreference",
      },
    ],
    re2: [
      {
        from: /\(\?<(\w+)>/g,
        to: "(?P<$1>",
        description: "Named group syntax",
      },
    ],
    go: [
      {
        from: /\(\?<(\w+)>/g,
        to: "(?P<$1>",
        description: "Named group syntax",
      },
    ],
    bre: [
      {
        from: /\(/g,
        to: "\\(",
        description: "Escape grouping parentheses",
      },
      {
        from: /\)/g,
        to: "\\)",
        description: "Escape grouping parentheses",
      },
      {
        from: /\+/g,
        to: "\\+",
        description: "Escape plus quantifier",
      },
      {
        from: /\?/g,
        to: "\\?",
        description: "Escape question mark quantifier",
      },
      {
        from: /\|/g,
        to: "\\|",
        description: "Escape alternation",
      },
      {
        from: /\{(\d+),?(\d*)}/g,
        to: "\\{$1,$2\\}",
        description: "Escape braces in quantifiers",
      },
    ],
  },
  python: {
    ecmascript: [
      {
        from: /\(\?P<(\w+)>/g,
        to: "(?<$1>",
        description: "Named group syntax",
      },
      {
        from: /\(\?P=(\w+)\)/g,
        to: "\\k<$1>",
        description: "Named backreference",
      },
    ],
    re2: [],
    go: [],
  },
  pcre: {
    ecmascript: [
      {
        from: /\(\?P<(\w+)>/g,
        to: "(?<$1>",
        description: "Named group syntax (P form)",
      },
      {
        from: /\(\?'(\w+)'/g,
        to: "(?<$1>",
        description: "Named group syntax (quote form)",
      },
    ],
    python: [
      {
        from: /\(\?<(\w+)>/g,
        to: "(?P<$1>",
        description: "Named group syntax",
      },
      {
        from: /\(\?'(\w+)'/g,
        to: "(?P<$1>",
        description: "Named group syntax",
      },
    ],
  },
  bre: {
    ere: [
      {
        from: /\\\(/g,
        to: "(",
        description: "Unescape grouping parentheses",
      },
      {
        from: /\\\)/g,
        to: ")",
        description: "Unescape grouping parentheses",
      },
      {
        from: /\\\+/g,
        to: "+",
        description: "Unescape plus quantifier",
      },
      {
        from: /\\\?/g,
        to: "?",
        description: "Unescape question mark",
      },
      {
        from: /\\\|/g,
        to: "|",
        description: "Unescape alternation",
      },
      {
        from: /\\\{(\d+),?(\d*)\\\}/g,
        to: "{$1,$2}",
        description: "Unescape braces",
      },
    ],
    ecmascript: [
      {
        from: /\\\(/g,
        to: "(",
        description: "Unescape grouping parentheses",
      },
      {
        from: /\\\)/g,
        to: ")",
        description: "Unescape grouping parentheses",
      },
      {
        from: /\\\+/g,
        to: "+",
        description: "Unescape plus quantifier",
      },
      {
        from: /\\\?/g,
        to: "?",
        description: "Unescape question mark",
      },
      {
        from: /\\\|/g,
        to: "|",
        description: "Unescape alternation",
      },
      {
        from: /\\\{(\d+),?(\d*)\\\}/g,
        to: "{$1,$2}",
        description: "Unescape braces",
      },
    ],
  },
  ere: {
    ecmascript: [],
    bre: [
      {
        from: /\(/g,
        to: "\\(",
        description: "Escape grouping parentheses",
      },
      {
        from: /\)/g,
        to: "\\)",
        description: "Escape grouping parentheses",
      },
      {
        from: /\+/g,
        to: "\\+",
        description: "Escape plus quantifier",
      },
      {
        from: /\?/g,
        to: "\\?",
        description: "Escape question mark",
      },
      {
        from: /\|/g,
        to: "\\|",
        description: "Escape alternation",
      },
      {
        from: /\{(\d+),?(\d*)}/g,
        to: "\\{$1,$2\\}",
        description: "Escape braces",
      },
    ],
  },
};

export interface ConversionResult {
  pattern: string;
  isCompatible: boolean;
  warnings: string[];
  changes: string[];
}

// Check for unsupported features in target flavor
function checkCompatibility(
  pattern: string,
  fromFlavor: RegexFlavor,
  toFlavor: RegexFlavor,
): string[] {
  const warnings: string[] = [];
  const toInfo = FLAVOR_INFO[toFlavor];

  // Check for lookahead/lookbehind
  if (
    toInfo.unsupported.some((u) => u.toLowerCase().includes("lookahead")) &&
    /\(\?[=!<]/.test(pattern)
  ) {
    warnings.push(
      `${toInfo.name} does not support lookahead/lookbehind assertions`,
    );
  }

  // Check for backreferences
  if (
    toInfo.unsupported.some((u) => u.toLowerCase().includes("backreference")) &&
    (/\\[1-9]/.test(pattern) ||
      /\\k<\w+>/.test(pattern) ||
      /\(\?P=\w+\)/.test(pattern))
  ) {
    warnings.push(`${toInfo.name} does not support backreferences`);
  }

  // Check for atomic groups
  if (
    toInfo.unsupported.some((u) => u.toLowerCase().includes("atomic")) &&
    /\(\?>/.test(pattern)
  ) {
    warnings.push(`${toInfo.name} does not support atomic groups`);
  }

  // Check for possessive quantifiers
  if (
    toInfo.unsupported.some((u) => u.toLowerCase().includes("possessive")) &&
    /[+*?]\+/.test(pattern)
  ) {
    warnings.push(`${toInfo.name} does not support possessive quantifiers`);
  }

  // Check for recursion
  if (
    toInfo.unsupported.some((u) => u.toLowerCase().includes("recursion")) &&
    /\(\?R\)|\(\?0\)|\(\?&\w+\)/.test(pattern)
  ) {
    warnings.push(`${toInfo.name} does not support recursion or subroutines`);
  }

  // Check for conditionals
  if (
    toInfo.unsupported.some((u) => u.toLowerCase().includes("conditional")) &&
    /\(\?\(/.test(pattern)
  ) {
    warnings.push(`${toInfo.name} does not support conditional patterns`);
  }

  // Check for Unicode properties
  if (
    toInfo.unsupported.some((u) => u.toLowerCase().includes("unicode")) &&
    /\\[pP]\{/.test(pattern)
  ) {
    warnings.push(`${toInfo.name} may not support Unicode property escapes`);
  }

  return warnings;
}

// Convert regex pattern between flavors
export function convertRegex(
  pattern: string,
  fromFlavor: RegexFlavor,
  toFlavor: RegexFlavor,
): ConversionResult {
  if (fromFlavor === toFlavor) {
    return {
      pattern,
      isCompatible: true,
      warnings: [],
      changes: [],
    };
  }

  let result = pattern;
  const changes: string[] = [];
  const warnings = checkCompatibility(pattern, fromFlavor, toFlavor);

  // Apply conversion rules
  const rules = CONVERSION_RULES[fromFlavor]?.[toFlavor];
  if (rules) {
    for (const rule of rules) {
      const before = result;
      if (typeof rule.to === "string") {
        result = result.replace(rule.from, rule.to);
      } else {
        result = result.replace(rule.from, rule.to);
      }
      if (before !== result) {
        changes.push(rule.description);
      }
    }
  }

  return {
    pattern: result,
    isCompatible: warnings.length === 0,
    warnings,
    changes,
  };
}

// Convert flags between flavors
export function convertFlags(
  flags: string,
  fromFlavor: RegexFlavor,
  toFlavor: RegexFlavor,
): { flags: string; warnings: string[] } {
  const toInfo = FLAVOR_INFO[toFlavor];
  const warnings: string[] = [];
  let result = "";

  for (const flag of flags) {
    if (toInfo.flags.includes(flag)) {
      result += flag;
    } else {
      warnings.push(`Flag '${flag}' is not supported in ${toInfo.name}`);
    }
  }

  return { flags: result, warnings };
}

// Parse a full pattern string based on flavor
export function parseFullPattern(
  input: string,
  flavor: RegexFlavor,
): ParsedPattern {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      raw: input,
      pattern: "",
      flags: "",
      inlineFlags: "",
      isValid: true,
    };
  }

  switch (flavor) {
    case "ecmascript": {
      // Format: /pattern/flags or just pattern
      if (trimmed.startsWith("/")) {
        const lastSlash = trimmed.lastIndexOf("/");
        if (lastSlash > 0) {
          const pattern = trimmed.slice(1, lastSlash);
          const flags = trimmed.slice(lastSlash + 1);
          // Validate flags
          const validFlags = /^[gimsuyyd]*$/.test(flags);
          if (!validFlags) {
            return {
              raw: input,
              pattern,
              flags,
              inlineFlags: "",
              isValid: false,
              error: `Invalid flags: ${flags}`,
            };
          }
          return { raw: input, pattern, flags, inlineFlags: "", isValid: true };
        }
      }
      // Plain pattern without delimiters
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    case "python": {
      // Format: (?aiLmsux)pattern or r"pattern" or just pattern
      // Check for inline flags at start
      const inlineFlagMatch = trimmed.match(/^\(\?([aiLmsux]+)\)(.*)$/s);
      if (inlineFlagMatch) {
        return {
          raw: input,
          pattern: inlineFlagMatch[2],
          flags: "",
          inlineFlags: inlineFlagMatch[1],
          isValid: true,
        };
      }
      // Check for raw string format r"..." or r'...'
      const rawMatch = trimmed.match(/^r["'](.*)["']$/s);
      if (rawMatch) {
        return {
          raw: input,
          pattern: rawMatch[1],
          flags: "",
          inlineFlags: "",
          isValid: true,
        };
      }
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    case "re2":
    case "go": {
      // Format: (?flags)pattern or (?flags:pattern) or just pattern
      const inlineFlagMatch = trimmed.match(/^\(\?([imsU]+)\)(.*)$/s);
      if (inlineFlagMatch) {
        return {
          raw: input,
          pattern: inlineFlagMatch[2],
          flags: "",
          inlineFlags: inlineFlagMatch[1],
          isValid: true,
        };
      }
      // Scoped flags (?flags:pattern)
      const scopedMatch = trimmed.match(/^\(\?([imsU]+):(.+)\)$/s);
      if (scopedMatch) {
        return {
          raw: input,
          pattern: scopedMatch[2],
          flags: "",
          inlineFlags: scopedMatch[1],
          isValid: true,
        };
      }
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    case "rust": {
      // Format: (?flags)pattern or just pattern
      const inlineFlagMatch = trimmed.match(/^\(\?([imsuUx]+)\)(.*)$/s);
      if (inlineFlagMatch) {
        return {
          raw: input,
          pattern: inlineFlagMatch[2],
          flags: "",
          inlineFlags: inlineFlagMatch[1],
          isValid: true,
        };
      }
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    case "pcre": {
      // Format: /pattern/flags or (?flags)pattern or just pattern
      if (trimmed.startsWith("/")) {
        const lastSlash = trimmed.lastIndexOf("/");
        if (lastSlash > 0) {
          const pattern = trimmed.slice(1, lastSlash);
          const flags = trimmed.slice(lastSlash + 1);
          return { raw: input, pattern, flags, inlineFlags: "", isValid: true };
        }
      }
      // Inline flags
      const inlineFlagMatch = trimmed.match(/^\(\?([imsxUJAD]+)\)(.*)$/s);
      if (inlineFlagMatch) {
        return {
          raw: input,
          pattern: inlineFlagMatch[2],
          flags: "",
          inlineFlags: inlineFlagMatch[1],
          isValid: true,
        };
      }
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    case "java": {
      // Format: (?flags)pattern or just pattern
      // Java supports (?idmsuxU) inline flags
      const inlineFlagMatch = trimmed.match(/^\(\?([idmsuxU]+)\)(.*)$/s);
      if (inlineFlagMatch) {
        return {
          raw: input,
          pattern: inlineFlagMatch[2],
          flags: "",
          inlineFlags: inlineFlagMatch[1],
          isValid: true,
        };
      }
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    case "dotnet": {
      // Format: (?flags)pattern or just pattern
      // .NET supports (?imnsx) inline flags
      const inlineFlagMatch = trimmed.match(/^\(\?([imnsx]+)\)(.*)$/s);
      if (inlineFlagMatch) {
        return {
          raw: input,
          pattern: inlineFlagMatch[2],
          flags: "",
          inlineFlags: inlineFlagMatch[1],
          isValid: true,
        };
      }
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    case "bre":
    case "ere": {
      // POSIX doesn't have inline flags, just plain patterns
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
    }

    default:
      return {
        raw: input,
        pattern: trimmed,
        flags: "",
        inlineFlags: "",
        isValid: true,
      };
  }
}

// Format pattern in the native syntax of a flavor
export function formatFullPattern(
  pattern: string,
  flags: string,
  flavor: RegexFlavor,
): string {
  if (!pattern) return "";

  switch (flavor) {
    case "ecmascript":
      return `/${pattern}/${flags}`;

    case "python": {
      // Convert flags to Python inline flags
      const pythonFlags = convertFlagsToPythonInline(flags);
      if (pythonFlags) {
        return `(?${pythonFlags})${pattern}`;
      }
      return pattern;
    }

    case "re2":
    case "go": {
      const goFlags = convertFlagsToGoInline(flags);
      if (goFlags) {
        return `(?${goFlags})${pattern}`;
      }
      return pattern;
    }

    case "rust": {
      const rustFlags = convertFlagsToRustInline(flags);
      if (rustFlags) {
        return `(?${rustFlags})${pattern}`;
      }
      return pattern;
    }

    case "pcre":
      if (flags) {
        return `/${pattern}/${flags}`;
      }
      return pattern;

    case "java": {
      const javaFlags = convertFlagsToJavaInline(flags);
      if (javaFlags) {
        return `(?${javaFlags})${pattern}`;
      }
      return pattern;
    }

    case "dotnet": {
      const dotnetFlags = convertFlagsToDotnetInline(flags);
      if (dotnetFlags) {
        return `(?${dotnetFlags})${pattern}`;
      }
      return pattern;
    }

    case "bre":
    case "ere":
      return pattern;

    default:
      return pattern;
  }
}

// Flag conversion helpers
function convertFlagsToPythonInline(flags: string): string {
  let result = "";
  if (flags.includes("i")) result += "i";
  if (flags.includes("m")) result += "m";
  if (flags.includes("s")) result += "s";
  if (flags.includes("u")) result += "u";
  return result;
}

function convertFlagsToGoInline(flags: string): string {
  let result = "";
  if (flags.includes("i")) result += "i";
  if (flags.includes("m")) result += "m";
  if (flags.includes("s")) result += "s";
  return result;
}

function convertFlagsToRustInline(flags: string): string {
  let result = "";
  if (flags.includes("i")) result += "i";
  if (flags.includes("m")) result += "m";
  if (flags.includes("s")) result += "s";
  if (flags.includes("u")) result += "u";
  return result;
}

function convertFlagsToJavaInline(flags: string): string {
  let result = "";
  if (flags.includes("i")) result += "i";
  if (flags.includes("m")) result += "m";
  if (flags.includes("s")) result += "s";
  if (flags.includes("u")) result += "u";
  if (flags.includes("d")) result += "d";
  return result;
}

function convertFlagsToDotnetInline(flags: string): string {
  let result = "";
  if (flags.includes("i")) result += "i";
  if (flags.includes("m")) result += "m";
  if (flags.includes("s")) result += "s";
  return result;
}

// Convert inline flags to ECMAScript flags
function convertInlineFlagsToEcmascript(
  inlineFlags: string,
  fromFlavor: RegexFlavor,
): string {
  let result = "";

  // Common flag mappings
  if (inlineFlags.includes("i")) result += "i"; // case insensitive
  if (inlineFlags.includes("m")) result += "m"; // multiline
  if (inlineFlags.includes("s")) result += "s"; // dotall

  // Note: some flags don't have ECMAScript equivalents
  // u (unicode) - add if present
  if (
    inlineFlags.includes("u") &&
    fromFlavor !== "go" &&
    fromFlavor !== "re2"
  ) {
    result += "u";
  }

  return result;
}

// Full pattern conversion between flavors
export function convertFullPattern(
  input: string,
  fromFlavor: RegexFlavor,
  toFlavor: RegexFlavor,
): {
  input: ParsedPattern;
  output: string;
  outputPattern: string;
  outputFlags: string;
  changes: string[];
  warnings: string[];
} {
  const parsed = parseFullPattern(input, fromFlavor);

  if (!parsed.isValid) {
    return {
      input: parsed,
      output: input,
      outputPattern: parsed.pattern,
      outputFlags: "",
      changes: [],
      warnings: [parsed.error || "Invalid pattern"],
    };
  }

  // Convert the pattern
  const patternConversion = convertRegex(parsed.pattern, fromFlavor, toFlavor);

  // Convert flags
  const combinedFlags =
    parsed.flags +
    convertInlineFlagsToEcmascript(parsed.inlineFlags, fromFlavor);
  const flagConversion = convertFlags(combinedFlags, fromFlavor, toFlavor);

  // Format output in target flavor syntax
  const outputPattern = patternConversion.pattern;
  const outputFlags = flagConversion.flags;
  const output = formatFullPattern(outputPattern, outputFlags, toFlavor);

  const changes = [...patternConversion.changes];
  if (parsed.inlineFlags && toFlavor !== fromFlavor) {
    changes.push(
      `Converted inline flags (?${parsed.inlineFlags}) to ${FLAVOR_INFO[toFlavor].name} format`,
    );
  }

  const warnings = [...patternConversion.warnings, ...flagConversion.warnings];

  return {
    input: parsed,
    output,
    outputPattern,
    outputFlags,
    changes,
    warnings,
  };
}

// Common regex patterns
export const COMMON_PATTERNS = [
  {
    name: "Email",
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    description: "Basic email validation",
  },
  {
    name: "URL",
    pattern: "https?://[\\w.-]+(?:/[\\w./-]*)?",
    description: "HTTP/HTTPS URLs",
  },
  {
    name: "IPv4",
    pattern:
      "(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)",
    description: "IPv4 address",
  },
  {
    name: "IPv6",
    pattern: "(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}",
    description: "Full IPv6 address",
  },
  {
    name: "Phone (US)",
    pattern: "\\(?[0-9]{3}\\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}",
    description: "US phone number",
  },
  {
    name: "Date (ISO)",
    pattern: "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])",
    description: "ISO date format",
  },
  {
    name: "Time (24h)",
    pattern: "(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?",
    description: "24-hour time",
  },
  {
    name: "Hex Color",
    pattern: "#(?:[0-9a-fA-F]{3}){1,2}",
    description: "Hex color code",
  },
  {
    name: "UUID",
    pattern:
      "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
    description: "UUID format",
  },
  {
    name: "Credit Card",
    pattern: "(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})",
    description: "Visa, MC, Amex",
  },
  {
    name: "Password",
    pattern:
      "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
    description: "Strong password",
  },
  {
    name: "Username",
    pattern: "^[a-zA-Z][a-zA-Z0-9_-]{2,15}$",
    description: "Alphanumeric username",
  },
  {
    name: "HTML Tag",
    pattern: "<([a-z][a-z0-9]*)\\b[^>]*>.*?</\\1>",
    description: "HTML tag with content",
  },
  {
    name: "Whitespace",
    pattern: "\\s+",
    description: "One or more whitespace",
  },
  { name: "Word", pattern: "\\b\\w+\\b", description: "Word boundary match" },
];
