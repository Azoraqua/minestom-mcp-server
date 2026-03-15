# Tool Reference

This document describes the public MCP tools exposed by this server.

## `ping`

Purpose: verify that the MCP server is reachable.

Inputs:
- `message` optional string to echo back

Returns:
- `ok`
- `timestamp`
- `echoedMessage`

## `get_server_info`

Purpose: inspect package metadata, runtime details, and tool inventory for this MCP server.

Inputs:
- `includeDependencies` optional boolean to include dependency versions from `package.json`

Returns:
- `name`
- `version`
- `description`
- `toolCount`
- `availableTools`
- `runtime`
- `knowledgeCatalog`
- optional `dependencies`

Notes:
- `knowledgeCatalog.environmentAwareTools` lists the tools that inspect repo or build state.

## `inspect_minestom_environment`

Purpose: inspect a workspace for Minestom and JVM project signals.

Inputs:
- `repoRoot` optional path to inspect; defaults to the current working directory

Returns:
- `repoRoot`
- `buildTool`
- `buildFiles`
- `projectRoots`
- `sourceRoots`
- `packageNamespaces`
- `languages`
- `entrypointFiles`
- `detectedTopics`
- `detectedApiSymbols`
- `existingLibraries`
- `jvmProject`
- `runDirectory`
- `runDirectories`
- `notes`

Notes:
- This scans the inspected directory as a workspace and also looks through subdirectories.
- `run/` is treated as a strong development signal, not as the only possible server root.
- `jvmProject` summarizes Gradle/Maven files, wrapper scripts, language roots, and confidence that the workspace is really JVM-backed.

## `inspect_minestom_build`

Purpose: interpret Gradle or Maven modules in a Minestom workspace.

Inputs:
- `repoRoot` optional path to inspect; defaults to the current working directory

Returns:
- `repoRoot`
- `primaryModuleRoot`
- `modules`
- `notes`

Each module includes:
- `moduleRoot`
- `buildTool`
- `buildFiles`
- `wrapperFiles`
- `plugins`
- `dependencies`
- `variables`
- `commands`
- `notes`
- optional `versionCatalog`

Gradle coverage:
- `plugins { ... }`
- `dependencies { ... }`
- `gradle.properties`
- `gradle/libs.versions.toml`
- wrapper scripts like `gradlew`
- discovered task/script names

Maven coverage:
- `pom.xml` dependencies
- `pom.xml` plugins
- `pom.xml` properties
- wrapper scripts like `mvnw`
- common command suggestions such as `package`, `test`, and `dependency:tree`

## `explain_minestom_pattern`

Purpose: explain official Minestom patterns for a topic.

Inputs:
- `topic` one of `bootstrap`, `instances`, `events`, `commands`, `scheduler`, `threading`
- `goal` optional string for extra context

Returns:
- topic-specific explanation
- key classes
- lifecycle notes
- common pitfalls
- official docs and javadoc links

## `lookup_minestom_api`

Purpose: look up curated Minestom API symbols relevant to common patterns.

Inputs:
- `symbol` search string
- `topic` optional topic filter

Returns:
- best curated matches with:
  - symbol
  - package name
  - summary
  - why it matters
  - related APIs
  - javadoc URL

Notes:
- This is a curated Minestom API index, not a full javadoc crawler.

## `plan_minestom_feature`

Purpose: produce a Minestom-oriented implementation outline.

Inputs:
- `featureType` one of `server-bootstrap`, `command`, `event-listener`, `instance-setup`, `scheduled-task`
- `targetName`
- `packageName`
- `language`
- `useCases` optional array of requested behaviors

Returns:
- `summary`
- `primaryTopic`
- `supportingTopics`
- `files`
- `keyApis`
- `implementationSteps`
- `threadSafetyNotes`
- `verificationSteps`

Notes:
- This tool is pattern-grounded and JVM-language aware, but it does not yet rewrite plans around detected Gradle or Maven modules automatically.

## `review_minestom_design`

Purpose: review a proposed design against common Minestom patterns.

Inputs:
- `featureType`
- `designNotes`

Returns:
- `fitAssessment`
- `strengths`
- `gaps`
- `riskyAssumptions`
- `threadTickConcerns`
- `recommendedTopics`
- `recommendedApis`

Notes:
- This is useful before implementing a feature when you want feedback on event ownership, instance design, scheduler use, and thread boundaries.

## `suggest_minestom_libraries`

Purpose: recommend Minestom ecosystem libraries using curated knowledge, optional live GitHub results, and repo-aware signals.

Inputs:
- `useCase`
- `category` optional filter
- `includeLiveResults` optional boolean
- `repoRoot` optional workspace path for environment-aware ranking

Returns:
- `query`
- `categoryFilter`
- `matchedCategories`
- `curatedResults`
- `liveResults`
- `mergedResults`
- optional `environment`
- optional `warning`

Notes:
- Curated results always come first.
- Live results come from GitHub repository search for `topic:minestom-library`.
- When `repoRoot` is provided, the tool first inspects the target workspace and uses detected Minestom and JVM signals to rank suggestions and suppress already-present libraries.
