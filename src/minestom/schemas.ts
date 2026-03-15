import * as z from "zod/v4";

export const minestomTopicValues = [
	"bootstrap",
	"instances",
	"events",
	"commands",
	"scheduler",
	"threading",
] as const;

export const minestomFeatureTypeValues = [
	"server-bootstrap",
	"command",
	"event-listener",
	"instance-setup",
	"scheduled-task",
] as const;

export const libraryCategoryValues = [
	"commands",
	"concurrency",
	"world-storage",
	"models-and-ui",
	"gameplay",
	"debugging",
] as const;

export const officialLinkKindValues = [
	"docs",
	"javadoc",
	"ecosystem",
	"github",
] as const;
export const librarySourceValues = ["curated", "live"] as const;
export const reviewAssessmentValues = ["strong", "partial", "weak"] as const;
export const languageValues = ["java", "kotlin"] as const;
export const buildToolValues = ["gradle", "maven", "unknown"] as const;

export const minestomTopicSchema = z.enum(minestomTopicValues);
export const minestomFeatureTypeSchema = z.enum(minestomFeatureTypeValues);
export const libraryCategorySchema = z.enum(libraryCategoryValues);
export const officialLinkKindSchema = z.enum(officialLinkKindValues);
export const librarySourceSchema = z.enum(librarySourceValues);
export const reviewAssessmentSchema = z.enum(reviewAssessmentValues);
export const languageSchema = z.enum(languageValues);
export const buildToolSchema = z.enum(buildToolValues);
export const environmentConfidenceSchema = z.enum([
	"strong",
	"partial",
	"weak",
]);

export const officialLinkSchema = z.object({
	kind: officialLinkKindSchema,
	label: z.string(),
	url: z.string().url(),
});

export const apiReferenceSchema = z.object({
	displayName: z.string(),
	javadocUrl: z.string().url(),
	kind: z.string(),
	officialLinks: z.array(officialLinkSchema),
	packageName: z.string(),
	relatedSymbols: z.array(z.string()),
	summary: z.string(),
	symbol: z.string(),
	topic: minestomTopicSchema,
	whyItMatters: z.string(),
});

export const librarySuggestionSchema = z.object({
	category: libraryCategorySchema,
	description: z.string(),
	fullName: z.string(),
	name: z.string(),
	rationale: z.string(),
	repoUrl: z.string().url(),
	source: librarySourceSchema,
	sourceLinks: z.array(officialLinkSchema),
	tags: z.array(z.string()),
});

export const environmentTopicHitSchema = z.object({
	evidence: z.array(z.string()),
	hits: z.number().int(),
	topic: minestomTopicSchema,
});

export const environmentApiHitSchema = z.object({
	hits: z.number().int(),
	symbol: z.string(),
	topic: minestomTopicSchema,
});

export const environmentLibraryHitSchema = z.object({
	fullName: z.string(),
	name: z.string(),
	reason: z.string(),
	repoUrl: z.string().url(),
});

export const runDirectorySummarySchema = z.object({
	exists: z.boolean(),
	fileCount: z.number().int(),
	jarFiles: z.array(z.string()),
	notableFiles: z.array(z.string()),
	relativePath: z.string(),
});

export const buildPluginSchema = z.object({
	id: z.string(),
	raw: z.string(),
	source: z.string(),
	version: z.string().optional(),
});

export const buildDependencySchema = z.object({
	artifact: z.string().optional(),
	configuration: z.string(),
	group: z.string().optional(),
	notation: z.string(),
	raw: z.string(),
	source: z.string(),
	version: z.string().optional(),
});

export const buildVariableSchema = z.object({
	name: z.string(),
	source: z.string(),
	value: z.string(),
});

export const buildCommandSchema = z.object({
	command: z.string(),
	source: z.string(),
	whyItMatters: z.string(),
});

export const versionCatalogLibrarySchema = z.object({
	alias: z.string(),
	module: z.string().optional(),
	raw: z.string(),
	version: z.string().optional(),
});

export const versionCatalogPluginSchema = z.object({
	alias: z.string(),
	id: z.string().optional(),
	raw: z.string(),
	version: z.string().optional(),
});

export const versionCatalogSummarySchema = z.object({
	libraries: z.array(versionCatalogLibrarySchema),
	path: z.string(),
	plugins: z.array(versionCatalogPluginSchema),
	versions: z.array(buildVariableSchema),
});

export const jvmProjectSummarySchema = z.object({
	buildSystemFiles: z.array(z.string()),
	confidence: environmentConfidenceSchema,
	isLikelyJvmProject: z.boolean(),
	signals: z.array(z.string()),
	wrapperFiles: z.array(z.string()),
});

export const environmentSummarySchema = z.object({
	buildFiles: z.array(z.string()),
	buildTool: buildToolSchema,
	detectedApiSymbols: z.array(environmentApiHitSchema),
	detectedTopics: z.array(environmentTopicHitSchema),
	entrypointFiles: z.array(z.string()),
	existingLibraries: z.array(environmentLibraryHitSchema),
	jvmProject: jvmProjectSummarySchema,
	languages: z.array(languageSchema),
	notes: z.array(z.string()),
	packageNamespaces: z.array(z.string()),
	projectRoots: z.array(z.string()),
	repoRoot: z.string(),
	runDirectory: runDirectorySummarySchema,
	runDirectories: z.array(runDirectorySummarySchema),
	sourceRoots: z.array(z.string()),
});

export const minestomBuildModuleSchema = z.object({
	buildFiles: z.array(z.string()),
	buildTool: buildToolSchema,
	commands: z.array(buildCommandSchema),
	dependencies: z.array(buildDependencySchema),
	moduleRoot: z.string(),
	notes: z.array(z.string()),
	plugins: z.array(buildPluginSchema),
	variables: z.array(buildVariableSchema),
	versionCatalog: versionCatalogSummarySchema.optional(),
	wrapperFiles: z.array(z.string()),
});

export const minestomBuildInspectionSchema = z.object({
	modules: z.array(minestomBuildModuleSchema),
	notes: z.array(z.string()),
	primaryModuleRoot: z.string().optional(),
	repoRoot: z.string(),
});

export type MinestomTopic = z.infer<typeof minestomTopicSchema>;
export type MinestomFeatureType = z.infer<typeof minestomFeatureTypeSchema>;
export type LibraryCategory = z.infer<typeof libraryCategorySchema>;
export type OfficialLink = z.infer<typeof officialLinkSchema>;
