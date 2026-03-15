# Contributing

Thanks for helping improve the Minestom MCP Server.

## Local Setup

1. Install Node.js 20 or newer.
2. Install pnpm 10.32.1 or newer.
3. Run `pnpm install`.

The `prepare` script installs Husky hooks automatically, so contributors get the same local checks as CI.

## Development Workflow

- Use `pnpm dev` for iterative work.
- Use `pnpm lint:fix` to apply Biome fixes and formatting before staging.
- Use `pnpm check` before opening a pull request. It runs the repo verification sequence: lint, typecheck, and build.
- Use `npm pack --dry-run` when changing packaging, docs, or release metadata.

## Pull Requests

- Keep changes focused and document user-facing behavior in `README.md`, `docs/tools.md`, or `CHANGELOG.md` when relevant.
- Include verification commands in the pull request description.
- Update examples or templates when changing the contributor workflow.

## Reporting Issues

- Use the GitHub issue templates for bugs and feature requests.
- For security-sensitive issues, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.
