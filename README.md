# Minestom MCP Server

A stdio MCP server for Minestom, implemented with the Model Context Protocol SDK and TanStack AI tool definitions.


![NPM Version](https://img.shields.io/npm/v/minestom-mcp)

## Install

Preferred package invocation:

```bash
npx -y minestom-mcp
```

Often a file like `.mcp.json` at your project root will be picked up by agents:

```json
{
  "mcpServers": {
    "minestom-mcp": {
      "command": "npx",
      "args": ["-y", "minestom-mcp"]
    }
  }
}
```

Installed command aliases:

```bash
minestom-mcp-server
minestom-mcp
```

Why this shape:
- `minestom-mcp-server` is the npm package name and the safest `npx` entrypoint.
- `minestom-mcp` is the shorter command alias after install.
- npm `npx` resolves the matching bin when one of the `bin` entries matches the package name, so publishing the package as `minestom-mcp-server` with a `minestom-mcp-server` bin keeps `npx -y minestom-mcp-server` reliable. Source: [npm npx docs](https://docs.npmjs.com/cli/v8/commands/npx/)

The tool surface is grounded in:
- the official Minestom docs at [minestom.net/docs](https://minestom.net/docs/introduction)
- the Minestom javadocs at [javadoc.minestom.net](https://javadoc.minestom.net)
- the Minestom ecosystem directory at [minestom.net/libraries](https://minestom.net/libraries)

Detailed tool documentation lives in [docs/tools.md](./docs/tools.md).

The repository also ships a publish-ready static docs site in [`docs/`](./docs/) plus a GitHub Pages workflow in [`/.github/workflows/deploy-docs.yml`](./.github/workflows/deploy-docs.yml).

Community and contribution docs live in [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md), and [SECURITY.md](./SECURITY.md).

## Tools

- `ping`: verifies that the MCP server is reachable.
- `get_server_info`: returns package metadata, runtime details, tool inventory, and knowledge-catalog coverage.
- `inspect_minestom_environment`: inspects the current workspace or `repoRoot`, including subdirectories, Gradle/Maven build signals, JVM source layouts, detected patterns, entrypoints, existing libraries, and any detected `run/` folders.
- `inspect_minestom_build`: interprets Gradle or Maven modules, including dependencies, plugins, wrapper commands, variables/properties, and Gradle version catalogs.
- `explain_minestom_pattern`: explains Minestom patterns for bootstrap, instances, events, commands, schedulers, and thread ownership.
- `lookup_minestom_api`: returns curated API matches with package names, related APIs, and javadoc links.
- `plan_minestom_feature`: produces a grounded implementation outline for Minestom feature types.
- `review_minestom_design`: reviews design notes against Minestom’s manager, event, instance, scheduler, and threading patterns.
- `suggest_minestom_libraries`: returns curated library suggestions, can optionally add live GitHub topic results, and now uses repository signals when available.

## Notes

- API lookup is curated around the most important Minestom symbols and patterns; it is not a full javadoc crawler.
- Library discovery is hybrid: curated results are always returned first, live GitHub `topic:minestom-library` search is optional, and repo-aware ranking can inspect the target project.
- Environment-aware tools default to the current working directory and inspect subdirectories as part of that workspace. You can pass `repoRoot` to inspect a different Minestom workspace, and `run/` is treated as a strong development signal rather than an assumed server root.
- Because Minestom is JVM-based, the environment scan explicitly looks for Gradle/Maven build files, common wrapper scripts, JVM source roots, and Java/Kotlin signals before treating a workspace as a likely Minestom server project.
- Build-aware inspection understands common Gradle dependency/plugin declarations in `build.gradle` or `build.gradle.kts`, reads `gradle/libs.versions.toml`, and parses Maven `pom.xml` dependencies, plugins, and properties.

## Development

```bash
pnpm install
pnpm dev
pnpm lint:fix
pnpm check
```

Husky installs local hooks during `pnpm install`. Commits run `lint-staged`, and pushes run the full `pnpm check` verification flow.

## Publish

The package is set up for npm publishing with:
- executable bins for `minestom-mcp-server` and `minestom-mcp`
- a shebang-included bundled entrypoint in `dist/server.js`
- `files` whitelisting for the publish tarball
- `prepack` and `prepublishOnly` verification hooks
- GitHub Actions publishing from [`.github/workflows/npm-publish.yml`](./.github/workflows/npm-publish.yml)
  via pnpm install/check steps and npm trusted publishing
- `publishConfig.access = public`

Recommended release flow:

```bash
pnpm check
npm pack --dry-run
npm publish
```
For npm trusted publishing, configure npm to trust the workflow filename
`npm-publish.yml` in `.github/workflows/`. The workflow now uses pnpm for
dependency installation and verification, then publishes with `npm publish`
through GitHub Actions OIDC instead of a long-lived `NPM_TOKEN`.
