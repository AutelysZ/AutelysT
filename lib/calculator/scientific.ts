export type AngleUnit = "deg" | "rad" | "grad"

export const constants = {
  pi: Math.PI,
  e: Math.E,
} as const

export const scientificFunctions = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  exp: Math.exp,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  factorial: (n: number): number => {
    if (n < 0) throw new Error("Factorial is not defined for negative numbers")
    if (n !== Math.floor(n)) throw new Error("Factorial is only defined for integers")
    if (n > 170) throw new Error("Factorial result too large")
    let result = 1
    for (let i = 2; i <= n; i++) {
      result *= i
    }
    return result
  },
  inv: (x: number): number => 1 / x,
  pow10: (x: number): number => Math.pow(10, x),
} as const

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

function toGradians(degrees: number): number {
  return degrees * (200 / 180)
}

function fromGradians(gradians: number): number {
  return gradians * (180 / 200)
}

function convertAngleToRadians(value: number, fromUnit: AngleUnit): number {
  switch (fromUnit) {
    case "deg":
      return toRadians(value)
    case "rad":
      return value
    case "grad":
      return toRadians(fromGradians(value))
    default:
      return value
  }
}

function convertAngleFromRadians(radians: number, toUnit: AngleUnit): number {
  switch (toUnit) {
    case "deg":
      return toDegrees(radians)
    case "rad":
      return radians
    case "grad":
      return toGradians(toDegrees(radians))
    default:
      return radians
  }
}

function tokenize(expression: string): string[] {
  const tokens: string[] = []
  let i = 0
  
  while (i < expression.length) {
    const char = expression[i]
    
    if (/\s/.test(char)) {
      i++
      continue
    }
    
    if (/\d/.test(char) || char === '.') {
      let num = ''
      while (i < expression.length && (/[\d.]/.test(expression[i]) || (expression[i] === 'e' && i + 1 < expression.length && /[+-]/.test(expression[i + 1])))) {
        num += expression[i]
        i++
      }
      tokens.push(num)
      continue
    }
    
    if (/[a-zA-Z]/.test(char)) {
      let ident = ''
      while (i < expression.length && /[a-zA-Z]/.test(expression[i])) {
        ident += expression[i]
        i++
      }
      tokens.push(ident)
      continue
    }
    
    if (/[+\-*/^%(),]/.test(char)) {
      tokens.push(char)
      i++
      continue
    }
    
    throw new Error(`Invalid character: ${char}`)
  }
  
  return tokens
}

function parse(tokens: string[]): any {
  let pos = 0
  
  function peek(): string | undefined {
    return tokens[pos]
  }
  
  function consume(): string | undefined {
    return tokens[pos++]
  }
  
  function parseNumber(): number {
    const token = consume()
    if (!token) throw new Error("Unexpected end of expression")
    
    if (/^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token)) {
      return parseFloat(token)
    }
    
    throw new Error(`Expected number, got ${token}`)
  }
  
  function parseFactor(): any {
    const token = peek()
    
    if (!token) throw new Error("Unexpected end of expression")
    
    // Numbers and constants
    if (/^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token) || token === 'pi' || token === 'e') {
      if (token === 'pi') return constants.pi
      if (token === 'e') return constants.e
      return parseNumber()
    }
    
    // Parentheses
    if (token === '(') {
      consume()
      const expr = parseExpression()
      if (peek() !== ')') throw new Error("Expected ')'")
      consume()
      return expr
    }
    
    // Unary minus
    if (token === '-') {
      consume()
      return -parseFactor()
    }
    
    // Functions
    if (/[a-zA-Z]+/.test(token)) {
      const funcName = consume()
      if (!funcName) throw new Error("Expected function name")
      if (peek() !== '(') throw new Error(`Expected '(' after function ${funcName}`)
      consume()
      
      const args: any[] = []
      if (peek() !== ')') {
        args.push(parseExpression())
        while (peek() === ',') {
          consume()
          args.push(parseExpression())
        }
      }
      
      if (peek() !== ')') throw new Error("Expected ')'")
      consume()
      
      return { type: 'function', name: funcName.toLowerCase(), args }
    }
    
    throw new Error(`Unexpected token: ${token}`)
  }
  
  function parsePower(): any {
    let left = parseFactor()
    
    while (peek() === '^') {
      consume()
      const right = parsePower() // Right-associative
      left = { type: 'binary', op: '^', left, right }
    }
    
    return left
  }
  
  function parseTerm(): any {
    let left = parsePower()
    
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume()!
      const right = parsePower()
      left = { type: 'binary', op, left, right }
    }
    
    return left
  }
  
  function parseExpression(): any {
    let left = parseTerm()
    
    while (peek() === '+' || peek() === '-') {
      const op = consume()!
      const right = parseTerm()
      left = { type: 'binary', op, left, right }
    }
    
    return left
  }
  
  const result = parseExpression()
  if (pos !== tokens.length) {
    throw new Error(`Unexpected token at position ${pos}: ${tokens[pos]}`)
  }
  
  return result
}

function evaluateNode(node: any, angleUnit: AngleUnit, lastAnswer: number = 0): number {
  if (typeof node === 'number') {
    return node
  }
  
  if (node.type === 'binary') {
    const left = evaluateNode(node.left, angleUnit, lastAnswer)
    const right = evaluateNode(node.right, angleUnit, lastAnswer)
    
    switch (node.op) {
      case '+': return left + right
      case '-': return left - right
      case '*': return left * right
      case '/': 
        if (right === 0) throw new Error("Division by zero")
        return left / right
      case '%': return left % right
      case '^': return Math.pow(left, right)
      default:
        throw new Error(`Unknown operator: ${node.op}`)
    }
  }
  
  if (node.type === 'function') {
    const args = node.args.map((arg: any) => evaluateNode(arg, angleUnit, lastAnswer))
    
    if (node.name === 'ans') {
      return lastAnswer
    }
    
    const func = scientificFunctions[node.name as keyof typeof scientificFunctions]
    if (!func) throw new Error(`Unknown function: ${node.name}`)
    
    // Handle trigonometric functions with angle conversion
    if (['sin', 'cos', 'tan'].includes(node.name)) {
      const radians = convertAngleToRadians(args[0], angleUnit)
      return (func as any)(radians)
    }
    
    // Handle inverse trigonometric functions with angle conversion
    if (['asin', 'acos', 'atan'].includes(node.name)) {
      const result = (func as any)(...args)
      return convertAngleFromRadians(result, angleUnit)
    }
    
    return (func as any)(...args)
  }
  
  throw new Error(`Unknown node type: ${node.type}`)
}

export function evaluate(expression: string, angleUnit: AngleUnit = "deg", lastAnswer: number = 0): number {
  if (!expression.trim()) {
    throw new Error("Empty expression")
  }
  
  try {
    const tokens = tokenize(expression)
    const ast = parse(tokens)
    return evaluateNode(ast, angleUnit, lastAnswer)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error("Invalid expression")
  }
}

export function formatResult(result: number): string {
  if (isNaN(result)) return "NaN"
  if (!isFinite(result)) return result > 0 ? "Infinity" : "-Infinity"
  
  // Use scientific notation for very large or small numbers
  if (Math.abs(result) >= 1e10 || (Math.abs(result) < 1e-6 && result !== 0)) {
    return result.toExponential(6)
  }
  
  // Round to avoid floating point artifacts
  const rounded = Math.round(result * 1e10) / 1e10
  
  // If it's essentially an integer, show as integer
  if (Math.abs(rounded - Math.round(rounded)) < 1e-10) {
    return Math.round(rounded).toString()
  }
  
  // Otherwise, show with appropriate precision
  return rounded.toString()
}