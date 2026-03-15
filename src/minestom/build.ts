import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { toolDefinition } from "@tanstack/ai";
import * as z from "zod/v4";
import type { TanStackServerTool } from "../tanstack-tools.js";
import { minestomBuildInspectionSchema } from "./schemas.js";

const BUILD_FILE_NAMES = [
	"build.gradle",
	"build.gradle.kts",
	"settings.gradle",
	"settings.gradle.kts",
	"pom.xml",
	"gradle.properties",
] as const;
const BUILD_FILE_PATHS = ["gradle/libs.versions.toml"] as const;
const WRAPPER_FILE_NAMES = [
	"gradlew",
	"gradlew.bat",
	"mvnw",
	"mvnw.cmd",
] as const;

const SKIP_DIRECTORIES = new Set([
	".git",
	".gradle",
	".idea",
	".mvn",
	"build",
	"dist",
	"node_modules",
	"out",
	"target",
]);

const MAX_BUILD_FILES = 120;
const MAX_TEXT_BYTES = 256 * 1024;

type BuildTool = z.infer<
	typeof minestomBuildInspectionSchema.shape.modules.element.shape.buildTool
>;
type BuildModule = z.infer<
	typeof minestomBuildInspectionSchema.shape.modules.element
>;

type BuildTextFile = {
	relativePath: string;
	text: string;
};

function normalizeRelativePath(relativePath: string): string {
	return relativePath.replaceAll("\\", "/");
}

function isBuildFile(relativePath: string): boolean {
	const normalizedPath = normalizeRelativePath(relativePath);
	const baseName = path.posix.basename(normalizedPath);

	return (
		(BUILD_FILE_NAMES as readonly string[]).includes(baseName) ||
		(BUILD_FILE_PATHS as readonly string[]).some(
			(buildPath) =>
				normalizedPath === buildPath ||
				normalizedPath.endsWith(`/${buildPath}`),
		)
	);
}

async function collectBuildFiles(rootPath: string): Promise<BuildTextFile[]> {
	const collected: BuildTextFile[] = [];

	async function walk(currentPath: string): Promise<void> {
		if (collected.length >= MAX_BUILD_FILES) {
			return;
		}

		let entries: Dirent[] = [];

		try {
			entries = await fs.readdir(currentPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (collected.length >= MAX_BUILD_FILES) {
				return;
			}

			const absolutePath = path.join(currentPath, entry.name);
			const relativePath = normalizeRelativePath(
				path.relative(rootPath, absolutePath),
			);

			if (entry.isDirectory()) {
				if (!SKIP_DIRECTORIES.has(entry.name)) {
					await walk(absolutePath);
				}

				continue;
			}

			if (!entry.isFile() || !isBuildFile(relativePath)) {
				continue;
			}

			try {
				const stats = await fs.stat(absolutePath);

				if (stats.size > MAX_TEXT_BYTES) {
					continue;
				}

				const text = await fs.readFile(absolutePath, "utf8");
				collected.push({ relativePath, text });
			} catch {}
		}
	}

	await walk(rootPath);
	return collected.sort((left, right) =>
		left.relativePath.localeCompare(right.relativePath),
	);
}

async function collectWrapperFiles(rootPath: string): Promise<string[]> {
	const wrappers: string[] = [];

	async function walk(currentPath: string): Promise<void> {
		let entries: Dirent[] = [];

		try {
			entries = await fs.readdir(currentPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const absolutePath = path.join(currentPath, entry.name);
			const relativePath = normalizeRelativePath(
				path.relative(rootPath, absolutePath),
			);

			if (entry.isDirectory()) {
				if (!SKIP_DIRECTORIES.has(entry.name)) {
					await walk(absolutePath);
				}

				continue;
			}

			if (
				entry.isFile() &&
				(WRAPPER_FILE_NAMES as readonly string[]).includes(entry.name)
			) {
				wrappers.push(relativePath);
			}
		}
	}

	await walk(rootPath);
	return wrappers.sort();
}

function uniq<T>(items: T[], key: (item: T) => string): T[] {
	const seen = new Set<string>();
	const result: T[] = [];

	for (const item of items) {
		const itemKey = key(item);

		if (seen.has(itemKey)) {
			continue;
		}

		seen.add(itemKey);
		result.push(item);
	}

	return result;
}

function resolveModuleRoot(relativePath: string): string {
	const normalizedPath = normalizeRelativePath(relativePath);

	if (normalizedPath.endsWith("/gradle/libs.versions.toml")) {
		return normalizedPath.slice(0, -"/gradle/libs.versions.toml".length) || ".";
	}

	const directory = normalizeRelativePath(path.posix.dirname(normalizedPath));
	return directory === "." ? "." : directory;
}

function detectBuildTool(buildFiles: string[]): BuildTool {
	if (
		buildFiles.some(
			(file) =>
				file.endsWith(".gradle") ||
				file.endsWith(".gradle.kts") ||
				file.endsWith("libs.versions.toml"),
		)
	) {
		return "gradle";
	}

	if (buildFiles.some((file) => file.endsWith("pom.xml"))) {
		return "maven";
	}

	return "unknown";
}

function findBlocks(text: string, blockName: string): string[] {
	const blocks: string[] = [];
	let searchIndex = 0;

	while (searchIndex < text.length) {
		const blockIndex = text.indexOf(blockName, searchIndex);

		if (blockIndex === -1) {
			break;
		}

		const openBraceIndex = text.indexOf("{", blockIndex);

		if (openBraceIndex === -1) {
			break;
		}

		let depth = 1;
		let cursor = openBraceIndex + 1;

		while (cursor < text.length && depth > 0) {
			const character = text[cursor];

			if (character === "{") {
				depth += 1;
			} else if (character === "}") {
				depth -= 1;
			}

			cursor += 1;
		}

		if (depth === 0) {
			blocks.push(text.slice(openBraceIndex + 1, cursor - 1));
			searchIndex = cursor;
		} else {
			break;
		}
	}

	return blocks;
}

function parseGradlePlugins(relativePath: string, text: string) {
	const plugins = [];
	const blocks = findBlocks(text, "plugins");

	for (const block of blocks) {
		for (const rawLine of block.split("\n")) {
			const line = rawLine.trim();

			if (!line || line.startsWith("//")) {
				continue;
			}

			const idMatch = line.match(
				/id\s*\(\s*["']([^"']+)["']\s*\)(?:\s+version\s+["']([^"']+)["'])?/,
			);
			const legacyIdMatch = line.match(
				/id\s+["']([^"']+)["'](?:\s+version\s+["']([^"']+)["'])?/,
			);
			const aliasMatch = line.match(/alias\s*\(\s*([^)]+)\s*\)/);
			const kotlinMatch = line.match(
				/kotlin\s*\(\s*["']([^"']+)["']\s*\)(?:\s+version\s+["']([^"']+)["'])?/,
			);
			const bareMatch = line.match(
				/^(java|application|java-library|maven-publish)$/,
			);

			if (idMatch) {
				const pluginId = idMatch[1];

				if (!pluginId) {
					continue;
				}

				plugins.push({
					id: pluginId,
					raw: line,
					source: relativePath,
					version: idMatch[2],
				});
			} else if (legacyIdMatch) {
				const pluginId = legacyIdMatch[1];

				if (!pluginId) {
					continue;
				}

				plugins.push({
					id: pluginId,
					raw: line,
					source: relativePath,
					version: legacyIdMatch[2],
				});
			} else if (aliasMatch) {
				const aliasId = aliasMatch[1];

				if (!aliasId) {
					continue;
				}

				plugins.push({
					id: aliasId.trim(),
					raw: line,
					source: relativePath,
				});
			} else if (kotlinMatch) {
				const kotlinTarget = kotlinMatch[1];

				if (!kotlinTarget) {
					continue;
				}

				plugins.push({
					id: `kotlin(${kotlinTarget})`,
					raw: line,
					source: relativePath,
					version: kotlinMatch[2],
				});
			} else if (bareMatch) {
				const pluginId = bareMatch[1];

				if (!pluginId) {
					continue;
				}

				plugins.push({
					id: pluginId,
					raw: line,
					source: relativePath,
				});
			}
		}
	}

	return plugins;
}

function parseDependencyNotation(notation: string) {
	const trimmed = notation.trim().replace(/,$/, "");
	const stringMatch = trimmed.match(/^["']([^"']+)["']$/);
	const normalized = stringMatch?.[1] ?? trimmed;
	const parts = normalized.split(":");
	const group = parts[0];
	const artifact = parts[1];
	const version = parts[2];

	if (
		group &&
		artifact &&
		parts.length >= 2 &&
		!normalized.startsWith("project(") &&
		!normalized.startsWith("libs.")
	) {
		return {
			artifact,
			group,
			notation: normalized,
			version,
		};
	}

	return {
		notation: normalized,
	};
}

function parseGradleDependencies(relativePath: string, text: string) {
	const dependencies = [];
	const blocks = findBlocks(text, "dependencies");

	for (const block of blocks) {
		for (const rawLine of block.split("\n")) {
			const line = rawLine.trim();

			if (!line || line.startsWith("//")) {
				continue;
			}

			const callMatch = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\((.+)\)$/);
			const infixMatch = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s+(.+)$/);
			const configuration = callMatch?.[1] ?? infixMatch?.[1];
			const notationRaw = callMatch?.[2] ?? infixMatch?.[2];

			if (!configuration || !notationRaw || configuration === "constraints") {
				continue;
			}

			const parsedNotation = parseDependencyNotation(notationRaw);
			dependencies.push({
				configuration,
				raw: line,
				source: relativePath,
				...parsedNotation,
			});
		}
	}

	return dependencies;
}

function parseGradleTasks(relativePath: string, text: string) {
	const commands = [];
	const matches = text.matchAll(
		/tasks\.(register|named)\s*\(\s*["']([^"']+)["']/g,
	);

	for (const match of matches) {
		const taskName = match[2];
		const discoveryKind = match[1];

		if (!taskName || !discoveryKind) {
			continue;
		}

		commands.push({
			command: taskName,
			source: relativePath,
			whyItMatters: `Gradle task discovered via tasks.${discoveryKind}().`,
		});
	}

	const legacyMatches = text.matchAll(/^\s*task\s+([A-Za-z0-9_-]+)/gm);

	for (const match of legacyMatches) {
		const taskName = match[1];

		if (!taskName) {
			continue;
		}

		commands.push({
			command: taskName,
			source: relativePath,
			whyItMatters: "Gradle task declared with the legacy `task` syntax.",
		});
	}

	return commands;
}

function parsePropertiesFile(relativePath: string, text: string) {
	const variables = [];

	for (const rawLine of text.split("\n")) {
		const line = rawLine.trim();

		if (!line || line.startsWith("#") || line.startsWith("!")) {
			continue;
		}

		const separatorIndex = line.indexOf("=");

		if (separatorIndex === -1) {
			continue;
		}

		variables.push({
			name: line.slice(0, separatorIndex).trim(),
			source: relativePath,
			value: line.slice(separatorIndex + 1).trim(),
		});
	}

	return variables;
}

function parseVersionCatalog(relativePath: string, text: string) {
	const versions = [];
	const libraries = [];
	const plugins = [];
	let currentSection = "";

	for (const rawLine of text.split("\n")) {
		const line = rawLine.trim();

		if (!line || line.startsWith("#")) {
			continue;
		}

		const sectionMatch = line.match(/^\[([^\]]+)\]$/);

		if (sectionMatch) {
			currentSection = sectionMatch[1] ?? "";
			continue;
		}

		const equalsIndex = line.indexOf("=");

		if (equalsIndex === -1) {
			continue;
		}

		const key = line.slice(0, equalsIndex).trim();
		const value = line.slice(equalsIndex + 1).trim();

		if (currentSection === "versions") {
			versions.push({
				name: key,
				source: relativePath,
				value,
			});
		} else if (currentSection === "libraries") {
			const moduleMatch = value.match(/module\s*=\s*["']([^"']+)["']/);
			const versionRefMatch = value.match(
				/version(?:\.ref)?\s*=\s*["']([^"']+)["']/,
			);
			libraries.push({
				alias: key,
				module: moduleMatch?.[1],
				raw: value,
				version: versionRefMatch?.[1],
			});
		} else if (currentSection === "plugins") {
			const idMatch = value.match(/id\s*=\s*["']([^"']+)["']/);
			const versionMatch = value.match(
				/version(?:\.ref)?\s*=\s*["']([^"']+)["']/,
			);
			plugins.push({
				alias: key,
				id: idMatch?.[1],
				raw: value,
				version: versionMatch?.[1],
			});
		}
	}

	return {
		libraries,
		path: relativePath,
		plugins,
		versions,
	};
}

function collectXmlBlocks(text: string, tagName: string) {
	return Array.from(
		text.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "g")),
	)
		.map((match) => match[1])
		.filter((block): block is string => block !== undefined);
}

function extractXmlValue(text: string, tagName: string) {
	return text
		.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`))?.[1]
		?.trim();
}

function parseMavenDependencies(relativePath: string, text: string) {
	const dependencies = [];

	for (const block of collectXmlBlocks(text, "dependency")) {
		const group = extractXmlValue(block, "groupId");
		const artifact = extractXmlValue(block, "artifactId");
		const version = extractXmlValue(block, "version");
		const scope = extractXmlValue(block, "scope") ?? "compile";

		if (!group || !artifact) {
			continue;
		}

		dependencies.push({
			artifact,
			configuration: scope,
			group,
			notation: version
				? `${group}:${artifact}:${version}`
				: `${group}:${artifact}`,
			raw: block.replace(/\s+/g, " ").trim(),
			source: relativePath,
			version,
		});
	}

	return dependencies;
}

function parseMavenPlugins(relativePath: string, text: string) {
	const plugins = [];

	for (const block of collectXmlBlocks(text, "plugin")) {
		const group = extractXmlValue(block, "groupId");
		const artifact = extractXmlValue(block, "artifactId");
		const version = extractXmlValue(block, "version");

		if (!artifact) {
			continue;
		}

		plugins.push({
			id: group ? `${group}:${artifact}` : artifact,
			raw: block.replace(/\s+/g, " ").trim(),
			source: relativePath,
			version,
		});
	}

	return plugins;
}

function parseMavenProperties(relativePath: string, text: string) {
	const propertiesBlock = collectXmlBlocks(text, "properties")[0];

	if (!propertiesBlock) {
		return [];
	}

	return Array.from(
		propertiesBlock.matchAll(/<([A-Za-z0-9_.-]+)>([\s\S]*?)<\/\1>/g),
	)
		.map((match) => {
			const name = match[1];
			const value = match[2];

			if (!name || value === undefined) {
				return undefined;
			}

			return {
				name,
				source: relativePath,
				value: value.trim(),
			};
		})
		.filter(
			(variable): variable is { name: string; source: string; value: string } =>
				variable !== undefined,
		);
}

function buildGradleCommands(
	moduleRoot: string,
	wrapperFiles: string[],
	tasks: { command: string; source: string; whyItMatters: string }[],
) {
	const wrapper =
		wrapperFiles.find((file) => file.endsWith("gradlew")) ??
		wrapperFiles.find((file) => file.endsWith("gradlew.bat"));
	const runner = wrapper
		? normalizeRelativePath(wrapper)
		: moduleRoot === "."
			? "gradle"
			: `cd ${moduleRoot} && gradle`;
	const commands = [
		{
			command: wrapper ? `${runner} build` : `${runner} build`,
			source: "gradle",
			whyItMatters: "Standard Gradle build command for JVM projects.",
		},
		{
			command: wrapper ? `${runner} tasks` : `${runner} tasks`,
			source: "gradle",
			whyItMatters:
				"Lists available Gradle tasks and helps inspect the build surface.",
		},
	];

	if (tasks.some((task) => task.command === "run")) {
		commands.push({
			command: wrapper ? `${runner} run` : `${runner} run`,
			source: "gradle",
			whyItMatters: "A `run` task is defined in the Gradle build.",
		});
	}

	return commands;
}

function buildMavenCommands(moduleRoot: string, wrapperFiles: string[]) {
	const wrapper =
		wrapperFiles.find((file) => file.endsWith("mvnw")) ??
		wrapperFiles.find((file) => file.endsWith("mvnw.cmd"));
	const runner = wrapper
		? normalizeRelativePath(wrapper)
		: moduleRoot === "."
			? "mvn"
			: `cd ${moduleRoot} && mvn`;

	return [
		{
			command: wrapper ? `${runner} package` : `${runner} package`,
			source: "maven",
			whyItMatters: "Standard Maven package command for JVM projects.",
		},
		{
			command: wrapper ? `${runner} test` : `${runner} test`,
			source: "maven",
			whyItMatters: "Standard Maven test command for JVM projects.",
		},
		{
			command: wrapper
				? `${runner} dependency:tree`
				: `${runner} dependency:tree`,
			source: "maven",
			whyItMatters:
				"Useful for interpreting effective Maven dependency resolution.",
		},
	];
}

function createGradleModule(
	moduleRoot: string,
	files: BuildTextFile[],
	wrapperFiles: string[],
): BuildModule {
	const buildFiles = files.map((file) => file.relativePath);
	const plugins = uniq(
		files.flatMap((file) => parseGradlePlugins(file.relativePath, file.text)),
		(plugin) => `${plugin.source}:${plugin.id}:${plugin.raw}`,
	);
	const dependencies = uniq(
		files.flatMap((file) =>
			file.relativePath.endsWith(".gradle") ||
			file.relativePath.endsWith(".kts")
				? parseGradleDependencies(file.relativePath, file.text)
				: [],
		),
		(dependency) =>
			`${dependency.source}:${dependency.configuration}:${dependency.notation}`,
	);
	const discoveredTasks = uniq(
		files.flatMap((file) => parseGradleTasks(file.relativePath, file.text)),
		(task) => `${task.source}:${task.command}`,
	);
	const variables = uniq(
		files.flatMap((file) => {
			if (file.relativePath.endsWith("gradle.properties")) {
				return parsePropertiesFile(file.relativePath, file.text);
			}

			return [];
		}),
		(variable) => `${variable.source}:${variable.name}`,
	);
	const versionCatalogFile = files.find((file) =>
		file.relativePath.endsWith("gradle/libs.versions.toml"),
	);
	const versionCatalog = versionCatalogFile
		? parseVersionCatalog(
				versionCatalogFile.relativePath,
				versionCatalogFile.text,
			)
		: undefined;
	const notes = [];

	if (
		versionCatalog &&
		versionCatalog.libraries.length === 0 &&
		versionCatalog.plugins.length === 0 &&
		versionCatalog.versions.length === 0
	) {
		notes.push(
			"A Gradle version catalog file was found, but no `[versions]`, `[libraries]`, or `[plugins]` entries were parsed.",
		);
	}

	if (dependencies.length === 0) {
		notes.push(
			"No Gradle dependency declarations were parsed from `dependencies { ... }` blocks.",
		);
	}

	return {
		buildFiles,
		buildTool: "gradle",
		commands: uniq(
			[
				...buildGradleCommands(moduleRoot, wrapperFiles, discoveredTasks),
				...discoveredTasks,
			],
			(command) => `${command.source}:${command.command}`,
		),
		dependencies,
		moduleRoot,
		notes,
		plugins,
		variables: versionCatalog
			? uniq(
					[...variables, ...versionCatalog.versions],
					(variable) => `${variable.source}:${variable.name}`,
				)
			: variables,
		versionCatalog,
		wrapperFiles,
	};
}

function createMavenModule(
	moduleRoot: string,
	files: BuildTextFile[],
	wrapperFiles: string[],
): BuildModule {
	const pomFile = files.find((file) => file.relativePath.endsWith("pom.xml"));
	const dependencies = pomFile
		? uniq(
				parseMavenDependencies(pomFile.relativePath, pomFile.text),
				(dependency) => `${dependency.configuration}:${dependency.notation}`,
			)
		: [];
	const plugins = pomFile
		? uniq(
				parseMavenPlugins(pomFile.relativePath, pomFile.text),
				(plugin) => `${plugin.id}:${plugin.version ?? ""}`,
			)
		: [];
	const variables = pomFile
		? uniq(
				parseMavenProperties(pomFile.relativePath, pomFile.text),
				(variable) => `${variable.source}:${variable.name}`,
			)
		: [];
	const notes = [];

	if (dependencies.length === 0) {
		notes.push("No Maven `<dependency>` entries were parsed from the pom.");
	}

	return {
		buildFiles: files.map((file) => file.relativePath),
		buildTool: "maven",
		commands: buildMavenCommands(moduleRoot, wrapperFiles),
		dependencies,
		moduleRoot,
		notes,
		plugins,
		variables,
		wrapperFiles,
	};
}

export async function inspectMinestomBuild(repoRootInput?: string) {
	const repoRoot = path.resolve(repoRootInput ?? process.cwd());
	const buildFiles = await collectBuildFiles(repoRoot);
	const wrapperFiles = await collectWrapperFiles(repoRoot);
	const moduleMap = new Map<string, BuildTextFile[]>();

	for (const file of buildFiles) {
		const moduleRoot = resolveModuleRoot(file.relativePath);
		const existing = moduleMap.get(moduleRoot) ?? [];
		existing.push(file);
		moduleMap.set(moduleRoot, existing);
	}

	const modules = Array.from(moduleMap.entries())
		.map(([moduleRoot, files]) => {
			const moduleWrapperFiles = wrapperFiles.filter((wrapperFile) => {
				return moduleRoot === "."
					? !wrapperFile.includes("/")
					: wrapperFile.startsWith(`${moduleRoot}/`);
			});
			const buildTool = detectBuildTool(files.map((file) => file.relativePath));

			if (buildTool === "gradle") {
				return createGradleModule(moduleRoot, files, moduleWrapperFiles);
			}

			if (buildTool === "maven") {
				return createMavenModule(moduleRoot, files, moduleWrapperFiles);
			}

			return {
				buildFiles: files.map((file) => file.relativePath),
				buildTool: "unknown" as const,
				commands: [],
				dependencies: [],
				moduleRoot,
				notes: [
					"Build files were detected, but they did not resolve cleanly to a Gradle or Maven module.",
				],
				plugins: [],
				variables: [],
				wrapperFiles: moduleWrapperFiles,
			};
		})
		.sort((left, right) => left.moduleRoot.localeCompare(right.moduleRoot));

	const notes = [];
	const primaryModuleRoot = modules.find(
		(module) => module.buildTool !== "unknown",
	)?.moduleRoot;

	if (modules.length === 0) {
		notes.push(
			"No Gradle or Maven build files were detected in the inspected directory tree.",
		);
	}

	if (
		modules.some(
			(module) => module.buildTool === "gradle" && module.versionCatalog,
		)
	) {
		notes.push(
			"Gradle version catalogs are parsed from `gradle/libs.versions.toml` when present.",
		);
	}

	if (modules.some((module) => module.buildTool === "maven")) {
		notes.push(
			"Maven parsing includes pom dependencies, plugins, properties, and wrapper-aware command suggestions.",
		);
	}

	return minestomBuildInspectionSchema.parse({
		modules,
		notes,
		primaryModuleRoot,
		repoRoot,
	});
}

const inspectMinestomBuildInputSchema = z.object({
	repoRoot: z
		.string()
		.optional()
		.describe(
			"Absolute or relative path to the Minestom workspace to inspect. Defaults to the current working directory.",
		),
});

export const inspectMinestomBuildTool: TanStackServerTool = toolDefinition({
	description:
		"Use this when you want Gradle or Maven specific interpretation for a Minestom workspace, including dependencies, plugins, wrapper commands, and variables from build files or version catalogs.",
	inputSchema: inspectMinestomBuildInputSchema,
	name: "inspect_minestom_build",
	outputSchema: minestomBuildInspectionSchema,
}).server(async (args) => {
	const { repoRoot } = inspectMinestomBuildInputSchema.parse(args);
	return inspectMinestomBuild(repoRoot);
});
