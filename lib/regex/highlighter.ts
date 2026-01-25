// Regex Syntax Highlighter

export interface HighlightToken {
  type:
    | "text"
    | "escape"
    | "quantifier"
    | "anchor"
    | "group"
    | "group-name"
    | "charset"
    | "charset-range"
    | "alternation"
    | "special"
    | "flag"
    | "error"
    | "comment"
    | "unicode"
    | "delimiter"
    | "inline-flag";
  value: string;
  start: number;
  end: number;
}

// Tokenize a regex pattern for syntax highlighting
export function tokenizeRegex(pattern: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  // Check for ECMAScript-style delimiters /pattern/flags
  if (pattern.startsWith("/")) {
    const lastSlash = pattern.lastIndexOf("/");
    if (lastSlash > 0) {
      // Opening delimiter
      tokens.push({
        type: "delimiter",
        value: "/",
        start: 0,
        end: 1,
      });

      // Tokenize the inner pattern
      const innerPattern = pattern.slice(1, lastSlash);
      const innerTokens = tokenizeRegexCore(innerPattern);
      for (const token of innerTokens) {
        tokens.push({
          ...token,
          start: token.start + 1,
          end: token.end + 1,
        });
      }

      // Closing delimiter
      tokens.push({
        type: "delimiter",
        value: "/",
        start: lastSlash,
        end: lastSlash + 1,
      });

      // Flags
      if (lastSlash + 1 < pattern.length) {
        tokens.push({
          type: "flag",
          value: pattern.slice(lastSlash + 1),
          start: lastSlash + 1,
          end: pattern.length,
        });
      }

      return tokens;
    }
  }

  // Check for inline flags at the start (?flags)pattern
  const inlineFlagMatch = pattern.match(/^\(\?([a-zA-Z]+)\)/);
  if (inlineFlagMatch) {
    tokens.push({
      type: "inline-flag",
      value: inlineFlagMatch[0],
      start: 0,
      end: inlineFlagMatch[0].length,
    });

    // Tokenize the rest
    const restTokens = tokenizeRegexCore(
      pattern.slice(inlineFlagMatch[0].length),
    );
    for (const token of restTokens) {
      tokens.push({
        ...token,
        start: token.start + inlineFlagMatch[0].length,
        end: token.end + inlineFlagMatch[0].length,
      });
    }

    return tokens;
  }

  // Check for Python raw string r"..." or r'...'
  const rawMatch = pattern.match(/^r(["'])(.*)(\1)$/);
  if (rawMatch) {
    tokens.push({
      type: "delimiter",
      value: `r${rawMatch[1]}`,
      start: 0,
      end: 2,
    });

    const innerTokens = tokenizeRegexCore(rawMatch[2]);
    for (const token of innerTokens) {
      tokens.push({
        ...token,
        start: token.start + 2,
        end: token.end + 2,
      });
    }

    tokens.push({
      type: "delimiter",
      value: rawMatch[3],
      start: pattern.length - 1,
      end: pattern.length,
    });

    return tokens;
  }

  // Default: tokenize as plain pattern
  return tokenizeRegexCore(pattern);
}

// Core tokenizer for the pattern itself (without delimiters)
function tokenizeRegexCore(pattern: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    const start = i;

    // Escape sequences
    if (char === "\\") {
      if (i + 1 < pattern.length) {
        const next = pattern[i + 1];

        // Unicode property escape \p{...} or \P{...}
        if ((next === "p" || next === "P") && pattern[i + 2] === "{") {
          const closeBrace = pattern.indexOf("}", i + 3);
          if (closeBrace !== -1) {
            tokens.push({
              type: "unicode",
              value: pattern.slice(i, closeBrace + 1),
              start,
              end: closeBrace + 1,
            });
            i = closeBrace + 1;
            continue;
          }
        }

        // Unicode code point \u{...} or \uXXXX
        if (next === "u") {
          if (pattern[i + 2] === "{") {
            const closeBrace = pattern.indexOf("}", i + 3);
            if (closeBrace !== -1) {
              tokens.push({
                type: "unicode",
                value: pattern.slice(i, closeBrace + 1),
                start,
                end: closeBrace + 1,
              });
              i = closeBrace + 1;
              continue;
            }
          } else if (/[0-9a-fA-F]{4}/.test(pattern.slice(i + 2, i + 6))) {
            tokens.push({
              type: "unicode",
              value: pattern.slice(i, i + 6),
              start,
              end: i + 6,
            });
            i += 6;
            continue;
          }
        }

        // Hex escape \xXX
        if (
          next === "x" &&
          /[0-9a-fA-F]{2}/.test(pattern.slice(i + 2, i + 4))
        ) {
          tokens.push({
            type: "escape",
            value: pattern.slice(i, i + 4),
            start,
            end: i + 4,
          });
          i += 4;
          continue;
        }

        // Named backreference \k<name>
        if (next === "k" && pattern[i + 2] === "<") {
          const closeAngle = pattern.indexOf(">", i + 3);
          if (closeAngle !== -1) {
            tokens.push({
              type: "special",
              value: pattern.slice(i, closeAngle + 1),
              start,
              end: closeAngle + 1,
            });
            i = closeAngle + 1;
            continue;
          }
        }

        // Standard escapes
        tokens.push({
          type: "escape",
          value: pattern.slice(i, i + 2),
          start,
          end: i + 2,
        });
        i += 2;
        continue;
      }
    }

    // Quantifiers
    if (char === "*" || char === "+" || char === "?") {
      let value = char;
      // Check for lazy or possessive modifier
      if (pattern[i + 1] === "?" || pattern[i + 1] === "+") {
        value += pattern[i + 1];
        i++;
      }
      tokens.push({
        type: "quantifier",
        value,
        start,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Counted quantifier {n}, {n,}, {n,m}
    if (char === "{") {
      const match = pattern.slice(i).match(/^\{(\d+)(,(\d*)?)?\}/);
      if (match) {
        let value = match[0];
        let end = i + match[0].length;
        // Check for lazy modifier
        if (pattern[end] === "?") {
          value += "?";
          end++;
        }
        tokens.push({
          type: "quantifier",
          value,
          start,
          end,
        });
        i = end;
        continue;
      }
    }

    // Anchors
    if (char === "^" || char === "$") {
      tokens.push({
        type: "anchor",
        value: char,
        start,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Alternation
    if (char === "|") {
      tokens.push({
        type: "alternation",
        value: char,
        start,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Groups
    if (char === "(") {
      // Look for special group types
      if (pattern[i + 1] === "?") {
        const rest = pattern.slice(i);

        // Comment (?#...)
        if (rest.startsWith("(?#")) {
          const closeParen = pattern.indexOf(")", i + 3);
          if (closeParen !== -1) {
            tokens.push({
              type: "comment",
              value: pattern.slice(i, closeParen + 1),
              start,
              end: closeParen + 1,
            });
            i = closeParen + 1;
            continue;
          }
        }

        // Named group (?<name>...) or (?P<name>...) or (?'name'...)
        const namedMatch = rest.match(/^\(\?(?:P?<([^>]+)>|'([^']+)')/);
        if (namedMatch) {
          const fullMatch = namedMatch[0];
          tokens.push({
            type: "group",
            value:
              fullMatch.slice(0, fullMatch.indexOf("<") + 1) ||
              fullMatch.slice(0, fullMatch.indexOf("'") + 1),
            start,
            end:
              start +
              fullMatch.length -
              (namedMatch[1] || namedMatch[2]).length -
              1,
          });
          const nameStart =
            start +
            fullMatch.length -
            (namedMatch[1] || namedMatch[2]).length -
            1;
          tokens.push({
            type: "group-name",
            value: namedMatch[1] || namedMatch[2],
            start: nameStart,
            end: nameStart + (namedMatch[1] || namedMatch[2]).length,
          });
          tokens.push({
            type: "group",
            value: fullMatch.endsWith(">") ? ">" : "'",
            start: start + fullMatch.length - 1,
            end: start + fullMatch.length,
          });
          i += fullMatch.length;
          continue;
        }

        // Lookahead/lookbehind (?=...) (?!...) (?<=...) (?<!...)
        const lookMatch = rest.match(/^\(\?<?[=!]/);
        if (lookMatch) {
          tokens.push({
            type: "group",
            value: lookMatch[0],
            start,
            end: i + lookMatch[0].length,
          });
          i += lookMatch[0].length;
          continue;
        }

        // Atomic group (?>...)
        if (rest.startsWith("(?>")) {
          tokens.push({
            type: "group",
            value: "(?>",
            start,
            end: i + 3,
          });
          i += 3;
          continue;
        }

        // Non-capturing group (?:...)
        if (rest.startsWith("(?:")) {
          tokens.push({
            type: "group",
            value: "(?:",
            start,
            end: i + 3,
          });
          i += 3;
          continue;
        }

        // Flags (?i), (?im), (?i-m), etc.
        const flagMatch = rest.match(/^\(\?([imnsxUJ-]+)\)/);
        if (flagMatch) {
          tokens.push({
            type: "flag",
            value: flagMatch[0],
            start,
            end: i + flagMatch[0].length,
          });
          i += flagMatch[0].length;
          continue;
        }

        // Conditional (?(...)...)
        if (rest.startsWith("(?(")) {
          tokens.push({
            type: "group",
            value: "(?(",
            start,
            end: i + 3,
          });
          i += 3;
          continue;
        }

        // Branch reset (?|...)
        if (rest.startsWith("(?|")) {
          tokens.push({
            type: "group",
            value: "(?|",
            start,
            end: i + 3,
          });
          i += 3;
          continue;
        }

        // Recursion (?R) or (?0)
        const recurMatch = rest.match(/^\(\?([R0])\)/);
        if (recurMatch) {
          tokens.push({
            type: "special",
            value: recurMatch[0],
            start,
            end: i + recurMatch[0].length,
          });
          i += recurMatch[0].length;
          continue;
        }

        // Subroutine (?&name) or (?1)
        const subMatch = rest.match(/^\(\?(?:&(\w+)|(\d+))\)/);
        if (subMatch) {
          tokens.push({
            type: "special",
            value: subMatch[0],
            start,
            end: i + subMatch[0].length,
          });
          i += subMatch[0].length;
          continue;
        }
      }

      // Regular group
      tokens.push({
        type: "group",
        value: "(",
        start,
        end: i + 1,
      });
      i++;
      continue;
    }

    if (char === ")") {
      tokens.push({
        type: "group",
        value: ")",
        start,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Character class [...]
    if (char === "[") {
      let j = i + 1;
      let value = "[";

      // Handle negation
      if (pattern[j] === "^") {
        value += "^";
        j++;
      }

      // Handle ] at start
      if (pattern[j] === "]") {
        value += "]";
        j++;
      }

      // Find closing bracket
      while (j < pattern.length) {
        if (pattern[j] === "\\") {
          value += pattern.slice(j, j + 2);
          j += 2;
        } else if (pattern[j] === "]") {
          value += "]";
          j++;
          break;
        } else {
          value += pattern[j];
          j++;
        }
      }

      tokens.push({
        type: "charset",
        value,
        start,
        end: j,
      });
      i = j;
      continue;
    }

    // Special characters
    if (char === ".") {
      tokens.push({
        type: "special",
        value: ".",
        start,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Regular text
    tokens.push({
      type: "text",
      value: char,
      start,
      end: i + 1,
    });
    i++;
  }

  return tokens;
}

// CSS classes for token types
export const TOKEN_CLASSES: Record<HighlightToken["type"], string> = {
  text: "text-foreground",
  escape: "text-amber-600 dark:text-amber-400",
  quantifier: "text-purple-600 dark:text-purple-400 font-bold",
  anchor: "text-pink-600 dark:text-pink-400 font-bold",
  group: "text-blue-600 dark:text-blue-400",
  "group-name": "text-green-600 dark:text-green-400 font-medium",
  charset: "text-cyan-600 dark:text-cyan-400",
  "charset-range": "text-cyan-500 dark:text-cyan-300",
  alternation: "text-red-600 dark:text-red-400 font-bold",
  special: "text-orange-600 dark:text-orange-400",
  flag: "text-violet-600 dark:text-violet-400 font-medium",
  error: "text-red-600 dark:text-red-400 underline decoration-wavy",
  comment: "text-gray-500 dark:text-gray-500 italic",
  unicode: "text-emerald-600 dark:text-emerald-400",
  delimiter: "text-gray-500 dark:text-gray-400",
  "inline-flag": "text-violet-600 dark:text-violet-400 font-medium",
};
