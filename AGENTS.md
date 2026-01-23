# AGENTS.md

This file defines how coding agents should operate in this repository. Follow it for all future requests.

## Repo Overview
- Next.js App Router + TypeScript + Tailwind + shadcn/ui.
- Tools live under `app/tools/<tool-id>`.
- Registry lives in `lib/tools/registry.ts`.
- URL sync + IndexedDB history are core behaviors for every tool.
- Layout uses `AppShell` with sidebar tool navigation.

## Always-On Requirements
- Preserve existing layout, structure, and UI interactions unless explicitly asked to change them.
- Keep changes minimal and scoped to the user request.
- Prefer reuse of existing components and helpers over new abstractions.
- Use ASCII in edits unless the target file already uses non-ASCII and the change requires it.
- Do not add new UI libraries unless explicitly requested.
- For large files (>2000 lines), try to split components into multiple files when editing them.
- When catching errors in code, log them to the console (e.g., `console.error`) before handling.

## Tool Implementation Rules
When adding or updating a tool:
- Add route files: `app/tools/<tool-id>/page.tsx`, `layout.tsx`, `loading.tsx`.
- Use `ToolPageWrapper` for layout and history integration.
- Use `useUrlSyncedState(toolId, schema)` with zod defaults for parameters.
- Sync all params/inputs to URL query, excluding output-only fields unless explicitly required.
- Keep result/output fields out of URL unless asked.
- Provide meaningful SEO text content for tool pages when required.
- Update `lib/tools/registry.ts` with `id`, `name`, `category`, `route`, `keywords`, and `seo`.
- Update homepage copy and README when new tools or major features are added.
- Create or update the tool's README whenever a tool is created or modified.
- Always read the tool's README before modifying a tool.
- Write unit tests for new utility functions in `tests/lib/<module>/`.
- Run type check and tests before marking a task complete.

## URL Sync & State Restore
- Parameters and inputs must reflect in the URL query string.
- On load and `popstate`, hydrate state from URL.
- Debounce URL updates for text fields; keep responsive for toggles/radios.
- If URL has no params, restore from latest history when appropriate.

## History (IndexedDB)
- Use `useToolHistoryContext`:
  - `addHistoryEntry` when input text changes.
  - `updateHistoryParams` when params change (do not create new entry).
- Auto-generation should not create history entries unless explicitly requested.
- Clicking a history entry must restore inputs and params and update URL.
- Support delete and clear history (tool/all) via the built-in panel.

## Categorization & Search
- Tools must be categorized and listed in the registry.
- Keep keywords accurate for sidebar search and OpenSearch routing.
- If adding new tools, ensure category is consistent with existing taxonomy.

## Core Platform Requirements (from initial spec)
- Route-level code splitting: each tool as its own route.
- Sidebar tool switcher with category collapsibles, search, and recently used.
- Rich homepage with tool discovery.
- OpenSearch support and `/search` redirect behavior.
- SEO metadata per tool route.
- Sitemap and robots should include tool routes.

## Commands & Automation

### Type Checking
Only run type checking when explicitly requested:
\`\`\`bash
npx tsc --noEmit
\`\`\`
When run, execute type checking for the entire project (no single-file checks).
Fix all TypeScript errors before committing. Use `pnpm build` to verify full compilation only when explicitly requested.

### Testing
Add or update unit tests for all new or modified code. Only run tests when explicitly requested:
\`\`\`bash
# Run all tests
npx vitest run

# Run tests with watch mode (during development)
npx vitest watch tests/lib/encoding/base64.test.ts
\`\`\`
When run, execute tests for the entire project (no single-file runs unless explicitly requested).

Test file location: `tests/` directory mirroring source structure (e.g., `tests/lib/encoding/` for `lib/encoding/`).

### Build & Lint
\`\`\`bash
# Full production build
pnpm build

# Start development server
pnpm dev

# Linting (if configured)
pnpm lint
\`\`\`
Only run build/lint commands when explicitly requested. When run, use the full-project commands above.

### Toolchain
Use existing dependencies:
- **Package manager**: `pnpm`
- **TypeScript**: v5 with strict mode, path aliases (`@/*`)
- **Framework**: Next.js 16 App Router
- **Testing**: Vitest (default config)
- **Validation**: Zod for runtime schema validation

Do not add new tools or libraries without explicit approval.

## Git & Safety
- Do not rewrite history.
- Do not revert unrelated user changes.
- Avoid destructive commands unless explicitly requested.

## Output Expectations
- Provide concise summaries with file paths.
- Suggest tests or next steps only when they make sense.
- Do not run type check (`npx tsc --noEmit`) or tests (`npx vitest run`) unless explicitly requested; when asked, run them for the entire project.
