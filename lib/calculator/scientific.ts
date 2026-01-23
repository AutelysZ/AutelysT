// Scientific Calculator Engine
// Supports standard operations, trigonometry, logarithms, powers, and more

export type AngleUnit = "deg" | "rad" | "grad"

export interface CalculatorState {
  display: string
  expression: string
  memory: number
  angleUnit: AngleUnit
  lastAnswer: number
  error: string | null
}

// Mathematical constants
export const constants = {
  pi: Math.PI,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2, // Golden ratio
  sqrt2: Math.SQRT2,
  sqrt3: Math.sqrt(3),
  ln2: Math.LN2,
  ln10: Math.LN10,
} as const

export type ConstantName = keyof typeof constants

// Convert angle to radians based on current unit
export function toRadians(value: number, unit: AngleUnit): number {
  switch (unit) {
    case "deg":
      return (value * Math.PI) / 180
    case "grad":
      return (value * Math.PI) / 200
    case "rad":
    default:
      return value
  }
}

// Convert radians to current angle unit
export function fromRadians(value: number, unit: AngleUnit): number {
  switch (unit) {
    case "deg":
      return (value * 180) / Math.PI
    case "grad":
      return (value * 200) / Math.PI
    case "rad":
    default:
      return value
  }
}

// Scientific functions
export const scientificFunctions = {
  // Trigonometric (input in current angle unit)
  sin: (x: number, unit: AngleUnit) => Math.sin(toRadians(x, unit)),
  cos: (x: number, unit: AngleUnit) => Math.cos(toRadians(x, unit)),
  tan: (x: number, unit: AngleUnit) => Math.tan(toRadians(x, unit)),
  
  // Inverse trigonometric (output in current angle unit)
  asin: (x: number, unit: AngleUnit) => fromRadians(Math.asin(x), unit),
  acos: (x: number, unit: AngleUnit) => fromRadians(Math.acos(x), unit),
  atan: (x: number, unit: AngleUnit) => fromRadians(Math.atan(x), unit),
  
  // Hyperbolic
  sinh: (x: number) => Math.sinh(x),
  cosh: (x: number) => Math.cosh(x),
  tanh: (x: number) => Math.tanh(x),
  asinh: (x: number) => Math.asinh(x),
  acosh: (x: number) => Math.acosh(x),
  atanh: (x: number) => Math.atanh(x),
  
  // Logarithmic
  ln: (x: number) => Math.log(x),
  log10: (x: number) => Math.log10(x),
  log2: (x: number) => Math.log2(x),
  
  // Exponential
  exp: (x: number) => Math.exp(x),
  pow10: (x: number) => Math.pow(10, x),
  pow2: (x: number) => Math.pow(2, x),
  
  // Roots and powers
  sqrt: (x: number) => Math.sqrt(x),
  cbrt: (x: number) => Math.cbrt(x),
  square: (x: number) => x * x,
  cube: (x: number) => x * x * x,
  
  // Other
  abs: (x: number) => Math.abs(x),
  floor: (x: number) => Math.floor(x),
  ceil: (x: number) => Math.ceil(x),
  round: (x: number) => Math.round(x),
  sign: (x: number) => Math.sign(x),
  
  // Factorial (for non-negative integers)
  factorial: (x: number): number => {
    if (x < 0 || !Number.isInteger(x)) {
      return gamma(x + 1) // Use gamma function for non-integers
    }
    if (x > 170) return Number.POSITIVE_INFINITY
    let result = 1
    for (let i = 2; i <= x; i++) {
      result *= i
    }
    return result
  },
  
  // Reciprocal
  inv: (x: number) => 1 / x,
  
  // Percentage
  percent: (x: number) => x / 100,
}

// Gamma function approximation (Lanczos)
function gamma(z: number): number {
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  }
  z -= 1
  const g = 7
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  let x = c[0]
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i)
  }
  const t = z + g + 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

// Token types for expression parsing
type TokenType = "number" | "operator" | "function" | "constant" | "paren"

interface Token {
  type: TokenType
  value: string
  precedence?: number
}

// Operator precedence
const precedence: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "%": 2, // Modulo
  "^": 3,
  "E": 3, // Scientific notation
}

// Right associative operators
const rightAssociative = new Set(["^"])

// Tokenize expression
function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  
  while (i < expression.length) {
    const char = expression[i]
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++
      continue
    }
    
    // Numbers (including decimals and negative)
    if (/[\d.]/.test(char) || (char === "-" && (tokens.length === 0 || tokens[tokens.length - 1].type === "operator" || tokens[tokens.length - 1].value === "("))) {
      let num = ""
      if (char === "-") {
        num = "-"
        i++
      }
      while (i < expression.length && /[\d.eE+-]/.test(expression[i])) {
        // Handle scientific notation
        if ((expression[i] === "e" || expression[i] === "E") && i + 1 < expression.length) {
          num += expression[i]
          i++
          if (expression[i] === "+" || expression[i] === "-") {
            num += expression[i]
            i++
          }
        } else if (expression[i] === "+" || expression[i] === "-") {
          break
        } else {
          num += expression[i]
          i++
        }
      }
      tokens.push({ type: "number", value: num })
      continue
    }
    
    // Operators
    if (["+", "-", "*", "/", "^", "%"].includes(char)) {
      tokens.push({ type: "operator", value: char, precedence: precedence[char] })
      i++
      continue
    }
    
    // Scientific notation operator (E)
    if (char === "E" && tokens.length > 0 && tokens[tokens.length - 1].type === "number") {
      tokens.push({ type: "operator", value: "E", precedence: precedence["E"] })
      i++
      continue
    }
    
    // Parentheses
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char })
      i++
      continue
    }
    
    // Functions and constants (alphabetic)
    if (/[a-zA-Z]/.test(char)) {
      let name = ""
      while (i < expression.length && /[a-zA-Z0-9]/.test(expression[i])) {
        name += expression[i]
        i++
      }
      const lowerName = name.toLowerCase()
      if (lowerName in constants) {
        tokens.push({ type: "constant", value: lowerName })
      } else {
        tokens.push({ type: "function", value: lowerName })
      }
      continue
    }
    
    // Unknown character - skip
    i++
  }
  
  return tokens
}

// Convert infix to postfix (Shunting Yard algorithm)
function toPostfix(tokens: Token[]): Token[] {
  const output: Token[] = []
  const operatorStack: Token[] = []
  
  for (const token of tokens) {
    switch (token.type) {
      case "number":
      case "constant":
        output.push(token)
        break
        
      case "function":
        operatorStack.push(token)
        break
        
      case "operator": {
        while (operatorStack.length > 0) {
          const top = operatorStack[operatorStack.length - 1]
          if (
            top.type === "operator" &&
            ((rightAssociative.has(token.value) && (top.precedence ?? 0) > (token.precedence ?? 0)) ||
              (!rightAssociative.has(token.value) && (top.precedence ?? 0) >= (token.precedence ?? 0)))
          ) {
            output.push(operatorStack.pop()!)
          } else {
            break
          }
        }
        operatorStack.push(token)
        break
      }
        
      case "paren":
        if (token.value === "(") {
          operatorStack.push(token)
        } else {
          while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].value !== "(") {
            output.push(operatorStack.pop()!)
          }
          operatorStack.pop() // Remove "("
          // If there's a function before the parenthesis, pop it
          if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === "function") {
            output.push(operatorStack.pop()!)
          }
        }
        break
    }
  }
  
  while (operatorStack.length > 0) {
    output.push(operatorStack.pop()!)
  }
  
  return output
}

// Evaluate postfix expression
function evaluatePostfix(postfix: Token[], angleUnit: AngleUnit, lastAnswer: number): number {
  const stack: number[] = []
  
  for (const token of postfix) {
    switch (token.type) {
      case "number":
        stack.push(parseFloat(token.value))
        break
        
      case "constant":
        if (token.value === "ans") {
          stack.push(lastAnswer)
        } else {
          stack.push(constants[token.value as ConstantName])
        }
        break
        
      case "operator": {
        const b = stack.pop() ?? 0
        const a = stack.pop() ?? 0
        switch (token.value) {
          case "+":
            stack.push(a + b)
            break
          case "-":
            stack.push(a - b)
            break
          case "*":
            stack.push(a * b)
            break
          case "/":
            stack.push(a / b)
            break
          case "^":
            stack.push(Math.pow(a, b))
            break
          case "%":
            stack.push(a % b)
            break
          case "E":
            stack.push(a * Math.pow(10, b))
            break
        }
        break
      }
        
      case "function": {
        const arg = stack.pop() ?? 0
        const fn = token.value.toLowerCase()
        
        // Trig functions with angle unit
        if (["sin", "cos", "tan"].includes(fn)) {
          stack.push(scientificFunctions[fn as "sin" | "cos" | "tan"](arg, angleUnit))
        } else if (["asin", "acos", "atan"].includes(fn)) {
          stack.push(scientificFunctions[fn as "asin" | "acos" | "atan"](arg, angleUnit))
        } else if (fn in scientificFunctions) {
          const func = scientificFunctions[fn as keyof typeof scientificFunctions]
          if (typeof func === "function") {
            stack.push((func as (x: number) => number)(arg))
          }
        } else {
          throw new Error(`Unknown function: ${fn}`)
        }
        break
      }
    }
  }
  
  return stack[0] ?? 0
}

// Main evaluation function
export function evaluate(expression: string, angleUnit: AngleUnit, lastAnswer: number): number {
  if (!expression.trim()) return 0
  
  const tokens = tokenize(expression)
  const postfix = toPostfix(tokens)
  return evaluatePostfix(postfix, angleUnit, lastAnswer)
}

// Format number for display
export function formatResult(value: number, precision = 10): string {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return "Error"
    return value > 0 ? "Infinity" : "-Infinity"
  }
  
  // Check if it's very close to zero
  if (Math.abs(value) < 1e-15) return "0"
  
  // Check if scientific notation is needed
  const absValue = Math.abs(value)
  if (absValue >= 1e10 || (absValue < 1e-6 && absValue > 0)) {
    return value.toExponential(precision - 1).replace(/\.?0+e/, "e").replace(/e\+/, "e")
  }
  
  // Regular number formatting
  const formatted = value.toPrecision(precision)
  // Remove trailing zeros after decimal point
  if (formatted.includes(".")) {
    return formatted.replace(/\.?0+$/, "")
  }
  return formatted
}

// Button categories for UI
export const buttonCategories = {
  number: ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "±"],
  operator: ["+", "-", "*", "/", "^", "%"],
  function: ["sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "ln", "log", "sqrt", "exp", "abs", "floor", "ceil", "round"],
  constant: ["pi", "e"],
  memory: ["MC", "MR", "M+", "M-", "MS"],
  control: ["AC", "C", "=", "(", ")", "Ans"],
} as const
