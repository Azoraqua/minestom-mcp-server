# Agent Guide

- Start with `README.md`, `CHANGELOG.md`, `docs/tools.md`, and `MEMORY.md`.
- Fetch first and keep local `main` and `develop` aligned with `origin` before starting new work when it is safe to do so.
- Use a dedicated branch or worktree per session. Do not reuse a dirty checkout.
- Keep changes small and preserve the current structure:
  - `src/server.ts` wires the MCP server
  - `src/tools.ts` is the public tool registry
  - `src/minestom/*.ts` holds the tool logic
  - `docs/tools.md` is the primary tool reference
- Prefer local docs and code, then Minestom docs and javadocs, then web search. Do not guess Minestom APIs or JVM build behavior.
- Preserve the current public contract unless the task explicitly changes it:
  - npm package and primary invocation: `minestom-mcp`
  - supported Node.js baseline: `>=22`
  - public tools must stay documented in `docs/tools.md`
- If you change a tool name, schema, or behavior, update the implementation, `src/tools.ts`, and the related docs in the same pass.
- Keep `README.md` concise and put detailed tool behavior in `docs/tools.md`.
- Use `MEMORY.md` for AI-facing knowledge and notes: progress, decisions, blockers, ownership, pending work, and other context worth reusing later.
- Run `pnpm check` for normal verification. There is no `pnpm test` script right now, so note that instead of inventing one.
- Use `CHANGELOG.md` only for concrete project changes after checks pass. Keep it brief and user-facing, and do not put memory-style notes there.
