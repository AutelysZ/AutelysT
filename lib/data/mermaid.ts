export const DEFAULT_MERMAID_SOURCE = `flowchart TD
  A[Start] --> B{Valid input?}
  B -- Yes --> C[Render SVG]
  B -- No --> D[Show error]
  C --> E[Download output]`;

export function sanitizeMermaidSource(input: string): string {
  return input.replace(/\t/g, "  ").trim();
}

export function createMermaidRenderId(): string {
  return `mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function extractMermaidErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Failed to render Mermaid diagram.";
}
