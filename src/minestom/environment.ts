import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { toolDefinition } from "@tanstack/ai";
import * as z from "zod/v4";
import type { TanStackServerTool } from "../tanstack-tools.js";
import { apiCatalog, curatedLibraries } from "./catalog.js";
import { environmentSummarySchema, type languageSchema } from "./schemas.js";

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

const TEXT_FILE_EXTENSIONS = new Set([
	".gradle",
	".java",
	".json",
	".kt",
	".kts",
	".md",
	".properties",
	".toml",
	".txt",
	".xml",
	".yaml",
	".yml",
]);

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

const MAX_SCANNED_FILES = 240;
const MAX_RUN_FILES = 60;
const MAX_RUN_DIRECTORIES = 12;
const MAX_TEXT_BYTES = 256 * 1024;

type BuildTool = z.infer<typeof environmentSummarySchema.shape.buildTool>;

type ScannedTextFile = {
	relativePath: string;
	text: string;
};

function uniq(items: string[]): string[] {
	return Array.from(new Set(items));
}

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

async function collectTextFiles(
	rootPath: string,
	maxFiles: number,
): Promise<ScannedTextFile[]> {
	const collected: ScannedTextFile[] = [];

	async function walk(currentPath: string): Promise<void> {
		if (collected.length >= maxFiles) {
			return;
		}

		let entries: Dirent[] = [];

		try {
			entries = await fs.readdir(currentPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (collected.length >= maxFiles) {
				return;
			}

			const absolutePath = path.join(currentPath, entry.name);
			const relativePath = path.relative(rootPath, absolutePath);

			if (entry.isDirectory()) {
				if (!SKIP_DIRECTORIES.has(entry.name)) {
					await walk(absolutePath);
				}

				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			const extension = path.extname(entry.name).toLowerCase();

			if (!TEXT_FILE_EXTENSIONS.has(extension) && !isBuildFile(relativePath)) {
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
	return collected;
}

async function summarizeRunDirectory(repoRoot: string, relativePath: string) {
	const runPath = path.join(repoRoot, relativePath);
	const files: string[] = [];
	const jarFiles: string[] = [];

	async function walk(currentPath: string): Promise<void> {
		if (files.length >= MAX_RUN_FILES) {
			return;
		}

		let entries: Dirent[] = [];

		try {
			entries = await fs.readdir(currentPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (files.length >= MAX_RUN_FILES) {
				return;
			}

			const absolutePath = path.join(currentPath, entry.name);
			const relativeFilePath = path.relative(repoRoot, absolutePath);

			if (entry.isDirectory()) {
				await walk(absolutePath);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			files.push(relativeFilePath);

			if (entry.name.endsWith(".jar")) {
				jarFiles.push(relativeFilePath);
			}
		}
	}

	await walk(runPath);

	return {
		exists: true,
		fileCount: files.length,
		jarFiles: jarFiles.slice(0, 20),
		notableFiles: files.slice(0, 20),
		relativePath: normalizeRelativePath(relativePath),
	};
}

async function collectRunDirectories(repoRoot: string) {
	const runDirectories: string[] = [];

	async function walk(currentPath: string): Promise<void> {
		if (runDirectories.length >= MAX_RUN_DIRECTORIES) {
			return;
		}

		let entries: Dirent[] = [];

		try {
			entries = await fs.readdir(currentPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (runDirectories.length >= MAX_RUN_DIRECTORIES) {
				return;
			}

			if (!entry.isDirectory()) {
				continue;
			}

			if (SKIP_DIRECTORIES.has(entry.name)) {
				continue;
			}

			const absolutePath = path.join(currentPath, entry.name);
			const relativePath = normalizeRelativePath(
				path.relative(repoRoot, absolutePath),
			);

			if (entry.name === "run") {
				runDirectories.push(relativePath);
			}

			await walk(absolutePath);
		}
	}

	await walk(repoRoot);
	return Promise.all(
		runDirectories.map((relativePath) =>
			summarizeRunDirectory(repoRoot, relativePath),
		),
	);
}

async function collectNamedFiles(
	repoRoot: string,
	names: readonly string[],
	maxFiles: number,
) {
	const results: string[] = [];

	async function walk(currentPath: string): Promise<void> {
		if (results.length >= maxFiles) {
			return;
		}

		let entries: Dirent[] = [];

		try {
			entries = await fs.readdir(currentPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (results.length >= maxFiles) {
				return;
			}

			const absolutePath = path.join(currentPath, entry.name);

			if (entry.isDirectory()) {
				if (!SKIP_DIRECTORIES.has(entry.name)) {
					await walk(absolutePath);
				}

				continue;
			}

			if (entry.isFile() && names.includes(entry.name)) {
				results.push(
					normalizeRelativePath(path.relative(repoRoot, absolutePath)),
				);
			}
		}
	}

	await walk(repoRoot);
	return results.sort();
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

	if (
		buildFiles.some((file) => normalizeRelativePath(file).endsWith("pom.xml"))
	) {
		return "maven";
	}

	return "unknown";
}

function summarizeJvmProject(
	buildFiles: string[],
	wrapperFiles: string[],
	languages: z.infer<typeof languageSchema>[],
	sourceRoots: string[],
	entrypointFiles: string[],
	detectedTopics: { topic: string }[],
) {
	const signals: string[] = [];

	if (buildFiles.length > 0) {
		signals.push(`Detected JVM build files: ${buildFiles.join(", ")}.`);
	}

	if (wrapperFiles.length > 0) {
		signals.push(`Detected build wrappers: ${wrapperFiles.join(", ")}.`);
	}

	if (languages.includes("java") || languages.includes("kotlin")) {
		signals.push(`Detected JVM languages: ${languages.join(", ")}.`);
	}

	if (
		sourceRoots.some((root) =>
			/src\/(main|test)\/(java|kotlin)/.test(normalizeRelativePath(root)),
		)
	) {
		signals.push(
			"Detected conventional JVM source roots under `src/main` or `src/test`.",
		);
	}

	if (entrypointFiles.length > 0) {
		signals.push(
			`Detected Minestom bootstrap entrypoints: ${entrypointFiles.join(", ")}.`,
		);
	}

	if (detectedTopics.length > 0) {
		signals.push(
			`Detected curated Minestom topics: ${detectedTopics.map((topic) => topic.topic).join(", ")}.`,
		);
	}

	const score =
		(buildFiles.length > 0 ? 4 : 0) +
		(wrapperFiles.length > 0 ? 2 : 0) +
		(languages.includes("java") || languages.includes("kotlin") ? 2 : 0) +
		(sourceRoots.some((root) =>
			/src\/(main|test)\/(java|kotlin)/.test(normalizeRelativePath(root)),
		)
			? 1
			: 0) +
		(entrypointFiles.length > 0 ? 2 : 0) +
		(detectedTopics.length > 0 ? 2 : 0);

	const confidence = score >= 6 ? "strong" : score >= 3 ? "partial" : "weak";

	return {
		buildSystemFiles: buildFiles,
		confidence,
		isLikelyJvmProject: score >= 3,
		signals,
		wrapperFiles,
	};
}

function detectProjectRoots(
	buildFiles: string[],
	sourceRoots: string[],
	entrypointFiles: string[],
	runDirectories: { relativePath: string }[],
) {
	const projectRoots = new Set<string>();
	const normalizeProjectRoot = (value: string) =>
		value === "" || value === "." ? "." : value;

	for (const buildFile of buildFiles) {
		const directory = normalizeRelativePath(path.dirname(buildFile));
		projectRoots.add(normalizeProjectRoot(directory));
	}

	for (const sourceRoot of sourceRoots) {
		const normalizedSourceRoot = normalizeRelativePath(sourceRoot);
		const projectRoot = normalizedSourceRoot.startsWith("src/")
			? "."
			: (normalizedSourceRoot.split("/src/")[0] ?? normalizedSourceRoot);
		projectRoots.add(normalizeProjectRoot(projectRoot));
	}

	for (const entrypointFile of entrypointFiles) {
		const normalizedEntrypoint = normalizeRelativePath(entrypointFile);
		const projectRoot = normalizedEntrypoint.startsWith("src/")
			? "."
			: (normalizedEntrypoint.split("/src/")[0] ??
				path.posix.dirname(normalizedEntrypoint));
		projectRoots.add(normalizeProjectRoot(projectRoot));
	}

	for (const runDirectory of runDirectories) {
		const projectRoot = path.posix.dirname(runDirectory.relativePath);
		projectRoots.add(projectRoot === "." ? "." : projectRoot);
	}

	return Array.from(projectRoots).sort();
}

function detectLanguages(files: ScannedTextFile[], buildFiles: string[]) {
	const languages = new Set<z.infer<typeof languageSchema>>();

	if (
		files.some((file) => file.relativePath.endsWith(".java")) ||
		buildFiles.includes("pom.xml")
	) {
		languages.add("java");
	}

	if (
		files.some(
			(file) =>
				file.relativePath.endsWith(".kt") || file.relativePath.endsWith(".kts"),
		) ||
		buildFiles.some((file) => file.endsWith(".kts"))
	) {
		languages.add("kotlin");
	}

	return Array.from(languages);
}

function detectSourceRoots(files: ScannedTextFile[]): string[] {
	const roots = new Set<string>();

	for (const file of files) {
		if (
			file.relativePath.startsWith(`src${path.sep}`) ||
			file.relativePath.startsWith("src/")
		) {
			const segments = file.relativePath.split(/[\\/]/);
			const root = segments
				.slice(0, Math.min(3, segments.length - 1))
				.join("/");

			if (root) {
				roots.add(root);
			}
		}
	}

	return Array.from(roots).sort();
}

function detectPackageNamespaces(files: ScannedTextFile[]): string[] {
	const namespaces = new Set<string>();

	for (const file of files) {
		if (
			!file.relativePath.endsWith(".java") &&
			!file.relativePath.endsWith(".kt")
		) {
			continue;
		}

		const match = file.text.match(/^\s*package\s+([A-Za-z0-9_.]+)\s*;?/m);

		if (match?.[1]) {
			namespaces.add(match[1]);
		}
	}

	return Array.from(namespaces).sort().slice(0, 20);
}

function detectEntrypointFiles(files: ScannedTextFile[]): string[] {
	return files
		.filter((file) => /\.(java|kt)$/.test(file.relativePath))
		.filter((file) =>
			/MinecraftServer\.init|MinecraftServer\.start|fun\s+main\s*\(|public\s+static\s+void\s+main\s*\(/.test(
				file.text,
			),
		)
		.map((file) => file.relativePath)
		.slice(0, 20);
}

function detectTopicsAndApis(files: ScannedTextFile[]) {
	const topicHits = new Map<string, { evidence: Set<string>; hits: number }>();
	const apiHits = new Map<string, { hits: number; topic: string }>();

	for (const file of files) {
		for (const api of apiCatalog) {
			const pattern = new RegExp(`\\b${api.symbol}\\b`, "g");
			const matches = file.text.match(pattern)?.length ?? 0;

			if (matches === 0) {
				continue;
			}

			const topicState = topicHits.get(api.topic) ?? {
				evidence: new Set<string>(),
				hits: 0,
			};
			topicState.evidence.add(file.relativePath);
			topicState.hits += matches;
			topicHits.set(api.topic, topicState);

			const apiState = apiHits.get(api.symbol) ?? { hits: 0, topic: api.topic };
			apiState.hits += matches;
			apiHits.set(api.symbol, apiState);
		}
	}

	const detectedTopics = Array.from(topicHits.entries())
		.map(([topic, data]) => ({
			evidence: Array.from(data.evidence).slice(0, 5),
			hits: data.hits,
			topic,
		}))
		.sort((left, right) => right.hits - left.hits);

	const detectedApiSymbols = Array.from(apiHits.entries())
		.map(([symbol, data]) => ({
			hits: data.hits,
			symbol,
			topic: data.topic,
		}))
		.sort((left, right) => right.hits - left.hits)
		.slice(0, 15);

	return { detectedApiSymbols, detectedTopics };
}

function detectExistingLibraries(files: ScannedTextFile[]) {
	const joinedText = files
		.filter((file) =>
			/\.(gradle|kts|xml|properties|toml|json|ya?ml|java|kt)$/.test(
				file.relativePath,
			),
		)
		.map((file) => file.text.toLowerCase())
		.join("\n");

	return curatedLibraries
		.map((library) => {
			const owner = library.fullName.split("/")[0]?.toLowerCase();
			const repoName = library.fullName.split("/")[1]?.toLowerCase();
			const nameToken = library.name.toLowerCase().replace(/\s+/g, "");
			const matchedTokens = [owner, repoName, nameToken].filter(
				(token): token is string =>
					!!token && token.length >= 4 && joinedText.includes(token),
			);

			if (matchedTokens.length === 0) {
				return undefined;
			}

			return {
				fullName: library.fullName,
				name: library.name,
				reason: `Matched repo/build text against tokens: ${uniq(matchedTokens).join(", ")}.`,
				repoUrl: library.repoUrl,
			};
		})
		.filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
}

export async function inspectMinestomEnvironment(repoRootInput?: string) {
	const repoRoot = path.resolve(repoRootInput ?? process.cwd());
	const scannedFiles = await collectTextFiles(repoRoot, MAX_SCANNED_FILES);
	const buildFiles = scannedFiles
		.map((file) => normalizeRelativePath(file.relativePath))
		.filter((relativePath) => isBuildFile(relativePath))
		.sort();
	const runDirectories = await collectRunDirectories(repoRoot);
	const wrapperFiles = await collectNamedFiles(
		repoRoot,
		WRAPPER_FILE_NAMES,
		20,
	);
	const runDirectory = runDirectories.find(
		(directory) => directory.relativePath === "run",
	) ??
		runDirectories[0] ?? {
			exists: false,
			fileCount: 0,
			jarFiles: [],
			notableFiles: [],
			relativePath: "run",
		};
	const { detectedApiSymbols, detectedTopics } =
		detectTopicsAndApis(scannedFiles);
	const entrypointFiles = detectEntrypointFiles(scannedFiles);
	const sourceRoots = detectSourceRoots(scannedFiles);
	const packageNamespaces = detectPackageNamespaces(scannedFiles);
	const languages = detectLanguages(scannedFiles, buildFiles);
	const existingLibraries = detectExistingLibraries(scannedFiles);
	const buildTool = detectBuildTool(buildFiles);
	const projectRoots = detectProjectRoots(
		buildFiles,
		sourceRoots,
		entrypointFiles,
		runDirectories,
	);
	const jvmProject = summarizeJvmProject(
		buildFiles,
		wrapperFiles,
		languages,
		sourceRoots,
		entrypointFiles,
		detectedTopics,
	);
	const notes: string[] = [];

	if (!jvmProject.isLikelyJvmProject) {
		notes.push(
			"The inspected directory tree does not yet strongly resemble a JVM project backed by Gradle or Maven.",
		);
	} else if (buildTool === "unknown") {
		notes.push(
			"JVM-oriented signals were detected, but no Gradle or Maven build file was found in the inspected directory tree.",
		);
	}

	if (detectedTopics.length === 0) {
		notes.push(
			"No curated Minestom API symbols were detected in the scanned source files.",
		);
	}

	if (runDirectories.length === 0) {
		notes.push(
			"No `run/` directory was found in the inspected directory or its scanned subdirectories.",
		);
	} else if (
		runDirectories.some((directory) => directory.jarFiles.length > 0)
	) {
		notes.push(
			"At least one detected `run/` directory contains JAR files that may represent local server extensions or supporting artifacts.",
		);
	}

	if (entrypointFiles.length === 0) {
		notes.push(
			"No clear Minestom bootstrap entrypoint was detected from `MinecraftServer` usage patterns.",
		);
	}

	if (projectRoots.length > 1) {
		notes.push(
			"Multiple candidate project roots were detected. Treat the inspection results as workspace-wide rather than assuming a single Minestom module.",
		);
	}

	return environmentSummarySchema.parse({
		buildFiles,
		buildTool,
		detectedApiSymbols,
		detectedTopics,
		entrypointFiles,
		existingLibraries,
		jvmProject,
		languages,
		notes,
		packageNamespaces,
		projectRoots,
		repoRoot,
		runDirectory,
		runDirectories,
		sourceRoots,
	});
}

const inspectMinestomEnvironmentInputSchema = z.object({
	repoRoot: z
		.string()
		.optional()
		.describe(
			"Absolute or relative path to the Minestom repository to inspect. Defaults to the current working directory.",
		),
});

export const inspectMinestomEnvironmentTool: TanStackServerTool =
	toolDefinition({
		description:
			"Use this when you want a Minestom workspace scan rooted at the current directory or `repoRoot`, including build files, source patterns, entrypoints, existing libraries, and any detected `run/` subdirectories.",
		inputSchema: inspectMinestomEnvironmentInputSchema,
		name: "inspect_minestom_environment",
		outputSchema: environmentSummarySchema,
	}).server(async (args) => {
		const { repoRoot } = inspectMinestomEnvironmentInputSchema.parse(args);
		return inspectMinestomEnvironment(repoRoot);
	});
