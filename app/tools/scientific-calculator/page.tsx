"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { Copy, Check, Delete, History, RotateCcw } from "lucide-react";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";
import {
  type AngleUnit,
  evaluate,
  formatResult,
  constants,
  scientificFunctions,
} from "@/lib/calculator/scientific";

const angleUnits = ["deg", "rad", "grad"] as const;

const paramsSchema = z.object({
  expression: z.string(),
  angleUnit: z.enum(angleUnits),
});

const defaultParams = {
  expression: "",
  angleUnit: "deg" as const,
};

const angleUnitLabels: Record<AngleUnit, string> = {
  deg: "DEG",
  rad: "RAD",
  grad: "GRAD",
};

// Calculator button component
function CalcButton({
  children,
  onClick,
  variant = "default",
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "operator" | "function" | "equals" | "clear" | "number";
  className?: string;
  disabled?: boolean;
}) {
  const variantStyles = {
    default: "bg-muted hover:bg-muted/80 text-foreground",
    number: "bg-background hover:bg-muted text-foreground border border-border",
    operator: "bg-primary/10 hover:bg-primary/20 text-primary font-medium",
    function:
      "bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs",
    equals: "bg-primary hover:bg-primary/90 text-primary-foreground font-bold",
    clear:
      "bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium",
  };

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 sm:h-12 w-full rounded-lg text-sm sm:text-base font-medium transition-all active:scale-95",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </Button>
  );
}

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-sm [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  );
}

export default function ScientificCalculatorPage() {
  return (
    <Suspense fallback={null}>
      <ScientificCalculatorContent />
    </Suspense>
  );
}

function ScientificCalculatorContent() {
  const {
    state: params,
    setParam,
    hasUrlParams,
  } = useUrlSyncedState("scientific-calculator", {
    schema: paramsSchema,
    defaults: defaultParams,
    debounceMs: DEFAULT_URL_SYNC_DEBOUNCE_MS,
  });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.expression !== undefined)
        setParam("expression", inputs.expression);
      if (params.angleUnit)
        setParam("angleUnit", params.angleUnit as AngleUnit);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="scientific-calculator"
      title="Scientific Calculator"
      description="Full-featured scientific calculator with trigonometric, logarithmic, and exponential functions, memory operations, and calculation history."
      onLoadHistory={handleLoadHistory}
    >
      <ScientificCalculatorInner
        state={params}
        setParam={setParam}
        hasUrlParams={hasUrlParams}
      />
    </ToolPageWrapper>
  );
}

function ScientificCalculatorInner({
  state,
  setParam,
  hasUrlParams,
}: {
  state: { expression: string; angleUnit: AngleUnit };
  setParam: <K extends keyof typeof state>(
    key: K,
    value: (typeof state)[K],
    immediate?: boolean,
  ) => void;
  hasUrlParams: boolean;
}) {
  const { addHistoryEntry } = useToolHistoryContext();

  const [display, setDisplay] = React.useState("0");
  const [expression, setExpression] = React.useState("");
  const [memory, setMemory] = React.useState(0);
  const [lastAnswer, setLastAnswer] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [calcHistory, setCalcHistory] = React.useState<
    { expr: string; result: string }[]
  >([]);
  const [copied, setCopied] = React.useState(false);
  const [showFunctions, setShowFunctions] = React.useState(false);

  // Sync expression with URL params
  React.useEffect(() => {
    if (state.expression) {
      setExpression(state.expression);
      try {
        const result = evaluate(state.expression, state.angleUnit, lastAnswer);
        setDisplay(formatResult(result));
        setError(null);
      } catch {
        setDisplay("0");
      }
    }
  }, [state.expression, state.angleUnit, lastAnswer]);

  const handleInput = React.useCallback(
    (value: string) => {
      setError(null);

      if (
        display === "Error" ||
        display === "Infinity" ||
        display === "-Infinity"
      ) {
        setDisplay(value);
        setExpression(value);
        return;
      }

      // Handle operators
      if (["+", "-", "*", "/", "^", "%"].includes(value)) {
        const newExpr = expression + value;
        setExpression(newExpr);
        setDisplay(value);
        return;
      }

      // Handle numbers and decimal
      if (/[\d.]/.test(value)) {
        const newExpr = expression + value;
        setExpression(newExpr);

        // Update display to show current number being entered
        const parts = newExpr.split(/[+\-*/^%()]/);
        const currentNum = parts[parts.length - 1] || value;
        setDisplay(currentNum);
        return;
      }

      // Handle functions
      if (
        value.toLowerCase() in scientificFunctions ||
        [
          "sin",
          "cos",
          "tan",
          "asin",
          "acos",
          "atan",
          "sinh",
          "cosh",
          "tanh",
          "ln",
          "log",
          "log10",
          "log2",
          "sqrt",
          "cbrt",
          "exp",
          "abs",
          "floor",
          "ceil",
          "round",
          "factorial",
          "inv",
          "percent",
        ].includes(value.toLowerCase())
      ) {
        const funcName = value.toLowerCase();
        const newExpr = expression + funcName + "(";
        setExpression(newExpr);
        setDisplay(funcName + "(");
        return;
      }

      // Handle constants
      if (value === "pi" || value === "π") {
        const newExpr = expression + "pi";
        setExpression(newExpr);
        setDisplay("π");
        return;
      }
      if (value === "e") {
        const newExpr = expression + "e";
        setExpression(newExpr);
        setDisplay("e");
        return;
      }

      // Handle parentheses
      if (value === "(" || value === ")") {
        const newExpr = expression + value;
        setExpression(newExpr);
        setDisplay(value);
        return;
      }

      // Handle Ans (last answer)
      if (value === "Ans" || value === "ans") {
        const newExpr = expression + "ans";
        setExpression(newExpr);
        setDisplay(formatResult(lastAnswer));
        return;
      }

      // Handle sign change
      if (value === "±") {
        if (expression) {
          // Try to negate the current expression or last number
          const newExpr = expression.startsWith("-")
            ? expression.slice(1)
            : "-" + expression;
          setExpression(newExpr);
          setDisplay(
            display.startsWith("-") ? display.slice(1) : "-" + display,
          );
        }
        return;
      }

      // Handle scientific notation
      if (value === "EE" || value === "E") {
        const newExpr = expression + "E";
        setExpression(newExpr);
        setDisplay("E");
        return;
      }

      // Handle x^2
      if (value === "x²") {
        const newExpr = expression + "^2";
        setExpression(newExpr);
        setDisplay("²");
        return;
      }

      // Handle x^3
      if (value === "x³") {
        const newExpr = expression + "^3";
        setExpression(newExpr);
        setDisplay("³");
        return;
      }

      // Handle x^y
      if (value === "xʸ") {
        const newExpr = expression + "^";
        setExpression(newExpr);
        setDisplay("^");
        return;
      }

      // Handle 1/x
      if (value === "1/x") {
        const newExpr = "inv(" + expression + ")";
        setExpression(newExpr);
        return;
      }

      // Handle n!
      if (value === "n!") {
        const newExpr = "factorial(" + expression + ")";
        setExpression(newExpr);
        return;
      }

      // Handle √
      if (value === "√") {
        const newExpr = "sqrt(" + expression;
        setExpression(newExpr);
        setDisplay("√(");
        return;
      }

      // Handle ³√
      if (value === "³√") {
        const newExpr = "cbrt(" + expression;
        setExpression(newExpr);
        setDisplay("³√(");
        return;
      }
    },
    [expression, display, lastAnswer],
  );

  const handleClear = React.useCallback(() => {
    setDisplay("0");
    setExpression("");
    setError(null);
  }, []);

  const handleDelete = React.useCallback(() => {
    if (expression.length > 0) {
      const newExpr = expression.slice(0, -1);
      setExpression(newExpr);
      if (newExpr.length === 0) {
        setDisplay("0");
      } else {
        // Show the last part of the expression
        const lastChar = newExpr[newExpr.length - 1];
        if (/\d/.test(lastChar)) {
          const parts = newExpr.split(/[+\-*/^%()]/);
          setDisplay(parts[parts.length - 1] || "0");
        } else {
          setDisplay(lastChar);
        }
      }
    }
  }, [expression]);

  const handleEquals = React.useCallback(() => {
    if (!expression) return;

    try {
      const result = evaluate(expression, state.angleUnit, lastAnswer);
      const formattedResult = formatResult(result);

      setDisplay(formattedResult);
      setLastAnswer(result);

      // Add to history
      setCalcHistory((prev) => [
        ...prev.slice(-19),
        { expr: expression, result: formattedResult },
      ]);

      // Save to tool history
      addHistoryEntry({ expression }, { angleUnit: state.angleUnit });

      // Update URL params
      setParam("expression", expression);

      // Clear expression for next input but keep result displayed
      setExpression(formattedResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation error");
      setDisplay("Error");
    }
  }, [expression, state, lastAnswer, addHistoryEntry, setParam]);

  // Memory operations
  const handleMemoryClear = () => setMemory(0);
  const handleMemoryRecall = () => {
    const memStr = formatResult(memory);
    setExpression(expression + memStr);
    setDisplay(memStr);
  };
  const handleMemoryAdd = () => {
    try {
      const current = evaluate(
        expression || display,
        state.angleUnit,
        lastAnswer,
      );
      setMemory(memory + current);
    } catch {
      // Ignore errors
    }
  };
  const handleMemorySubtract = () => {
    try {
      const current = evaluate(
        expression || display,
        state.angleUnit,
        lastAnswer,
      );
      setMemory(memory - current);
    } catch {
      // Ignore errors
    }
  };
  const handleMemoryStore = () => {
    try {
      const current = evaluate(
        expression || display,
        state.angleUnit,
        lastAnswer,
      );
      setMemory(current);
    } catch {
      // Ignore errors
    }
  };

  const handleCopy = React.useCallback(async () => {
    await navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [display]);

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleEquals();
      } else if (e.key === "Escape") {
        handleClear();
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (/^[\d.+\-*/^%()]$/.test(e.key)) {
        handleInput(e.key);
      }
    },
    [handleEquals, handleClear, handleDelete, handleInput],
  );

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Mode Selection */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              Angle:
            </span>
            <Tabs
              value={state.angleUnit}
              onValueChange={(value) =>
                setParam("angleUnit", value as AngleUnit)
              }
              className="flex-1 sm:flex-none"
            >
              <ScrollableTabsList>
                {angleUnits.map((unit) => (
                  <TabsTrigger
                    key={unit}
                    value={unit}
                    className="text-xs sm:text-sm"
                  >
                    {angleUnitLabels[unit]}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto justify-between sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFunctions(!showFunctions)}
              className={cn(showFunctions && "bg-muted", "text-xs sm:text-sm")}
            >
              {showFunctions ? "Basic" : "Scientific"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className={cn(showHistory && "bg-muted", "h-8 w-8 sm:h-9 sm:w-9")}
            >
              <History className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Display */}
      <div className="rounded-xl border bg-muted/50 p-4 w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[60%] sm:max-w-[80%]">
            {expression || "0"}
          </span>
          <div className="flex items-center gap-1">
            {memory !== 0 && (
              <span className="text-xs text-primary font-medium px-1.5 py-0.5 bg-primary/10 rounded">
                M
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div
          className={cn(
            "text-right font-mono text-3xl sm:text-4xl font-bold tracking-tight break-all",
            error && "text-destructive",
          )}
        >
          {display}
        </div>
        {error && (
          <p className="text-xs text-destructive mt-1 break-words">{error}</p>
        )}
      </div>

      {/* History Panel */}
      {showHistory && calcHistory.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 max-h-32 overflow-y-auto w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              History
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs shrink-0"
              onClick={() => setCalcHistory([])}
            >
              Clear
            </Button>
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {calcHistory
              .slice()
              .reverse()
              .map((item, i) => (
                <button
                  key={`${item.expr}-${i}`}
                  onClick={() => {
                    setExpression(item.result);
                    setDisplay(item.result);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-muted transition-colors truncate"
                >
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    {item.expr} =
                  </span>
                  <span className="text-sm font-mono ml-2 truncate">
                    {item.result}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Calculator Buttons */}
      <div className="flex flex-col gap-2 w-full max-w-lg mx-auto">
        {/* Scientific Functions Row */}
        {showFunctions && (
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-2 text-xs sm:text-sm">
            <CalcButton variant="function" onClick={() => handleInput("sin")}>
              sin
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("cos")}>
              cos
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("tan")}>
              tan
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("ln")}>
              ln
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("log10")}>
              log
            </CalcButton>

            <CalcButton variant="function" onClick={() => handleInput("asin")}>
              sin⁻¹
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("acos")}>
              cos⁻¹
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("atan")}>
              tan⁻¹
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("exp")}>
              eˣ
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("pow10")}>
              10ˣ
            </CalcButton>

            <CalcButton variant="function" onClick={() => handleInput("sinh")}>
              sinh
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("cosh")}>
              cosh
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("tanh")}>
              tanh
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("√")}>
              √
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("³√")}>
              ³√
            </CalcButton>

            <CalcButton variant="function" onClick={() => handleInput("x²")}>
              x²
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("x³")}>
              x³
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("xʸ")}>
              xʸ
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("1/x")}>
              1/x
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("n!")}>
              n!
            </CalcButton>

            <CalcButton variant="function" onClick={() => handleInput("pi")}>
              π
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("e")}>
              e
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("EE")}>
              EE
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("abs")}>
              |x|
            </CalcButton>
            <CalcButton variant="function" onClick={() => handleInput("%")}>
              mod
            </CalcButton>
          </div>
        )}

        {/* Memory Row */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 text-xs sm:text-sm">
          <CalcButton variant="function" onClick={handleMemoryClear}>
            MC
          </CalcButton>
          <CalcButton variant="function" onClick={handleMemoryRecall}>
            MR
          </CalcButton>
          <CalcButton variant="function" onClick={handleMemoryAdd}>
            M+
          </CalcButton>
          <CalcButton variant="function" onClick={handleMemorySubtract}>
            M-
          </CalcButton>
          <CalcButton variant="function" onClick={handleMemoryStore}>
            MS
          </CalcButton>
        </div>

        {/* Main Calculator Grid */}
        <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
          {/* Row 1 */}
          <CalcButton variant="clear" onClick={handleClear}>
            AC
          </CalcButton>
          <CalcButton variant="function" onClick={() => handleInput("(")}>
            (
          </CalcButton>
          <CalcButton variant="function" onClick={() => handleInput(")")}>
            )
          </CalcButton>
          <CalcButton variant="operator" onClick={() => handleInput("/")}>
            ÷
          </CalcButton>

          {/* Row 2 */}
          <CalcButton variant="number" onClick={() => handleInput("7")}>
            7
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput("8")}>
            8
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput("9")}>
            9
          </CalcButton>
          <CalcButton variant="operator" onClick={() => handleInput("*")}>
            ×
          </CalcButton>

          {/* Row 3 */}
          <CalcButton variant="number" onClick={() => handleInput("4")}>
            4
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput("5")}>
            5
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput("6")}>
            6
          </CalcButton>
          <CalcButton variant="operator" onClick={() => handleInput("-")}>
            −
          </CalcButton>

          {/* Row 4 */}
          <CalcButton variant="number" onClick={() => handleInput("1")}>
            1
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput("2")}>
            2
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput("3")}>
            3
          </CalcButton>
          <CalcButton variant="operator" onClick={() => handleInput("+")}>
            +
          </CalcButton>

          {/* Row 5 */}
          <CalcButton variant="number" onClick={() => handleInput("±")}>
            ±
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput("0")}>
            0
          </CalcButton>
          <CalcButton variant="number" onClick={() => handleInput(".")}>
            .
          </CalcButton>
          <CalcButton variant="equals" onClick={handleEquals}>
            =
          </CalcButton>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5 mt-1 text-xs sm:text-sm">
          <CalcButton variant="function" onClick={handleDelete}>
            <Delete className="h-3 w-3 sm:h-4 sm:w-4" />
          </CalcButton>
          <CalcButton variant="function" onClick={() => handleInput("Ans")}>
            Ans
          </CalcButton>
          <CalcButton
            variant="function"
            onClick={() => {
              handleClear();
              setLastAnswer(0);
              setMemory(0);
            }}
          >
            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
          </CalcButton>
        </div>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="text-xs text-muted-foreground text-center px-2 hidden sm:block">
        <span>
          Keyboard: Numbers, operators (+, -, *, /, ^), Enter = calculate,
          Escape = clear, Backspace = delete
        </span>
      </div>
    </div>
  );
}
