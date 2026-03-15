import { toolDefinition } from "@tanstack/ai";
import * as z from "zod/v4";
import type { TanStackServerTool } from "../tanstack-tools.js";
import { curatedLibraries } from "./catalog.js";
import { inspectMinestomEnvironment } from "./environment.js";
import {
	environmentSummarySchema,
	libraryCategorySchema,
	librarySuggestionSchema,
} from "./schemas.js";
import { normalizeText, scoreTextQuery, tokenize, uniqueBy } from "./search.js";

type LiveRepository = {
	description: string | null;
	full_name: string;
	html_url: string;
};

const suggestMinestomLibrariesInputSchema = z.object({
	category: libraryCategorySchema
		.optional()
		.describe(
			"Optional curated category filter to narrow the ecosystem suggestions.",
		),
	includeLiveResults: z
		.boolean()
		.default(false)
		.describe(
			"When true, also search live GitHub repositories tagged with the Minestom library topic.",
		),
	repoRoot: z
		.string()
		.optional()
		.describe(
			"Absolute or relative path to the target Minestom repository. Defaults to the current working directory for environment-aware suggestions.",
		),
	useCase: z
		.string()
		.describe(
			"Describe the problem space, such as command framework, world persistence, debug rendering, or Kotlin coroutines.",
		),
});

const suggestMinestomLibrariesOutputSchema = z.object({
	categoryFilter: libraryCategorySchema.optional(),
	curatedResults: z.array(librarySuggestionSchema),
	environment: environmentSummarySchema.optional(),
	liveResults: z.array(librarySuggestionSchema),
	matchedCategories: z.array(libraryCategorySchema),
	mergedResults: z.array(librarySuggestionSchema),
	query: z.string(),
	warning: z.string().optional(),
});

function inferCategoriesFromUseCase(useCase: string): string[] {
	const normalizedUseCase = normalizeText(useCase);
	const inferredCategories = new Set<string>();

	if (/(command|syntax|argument|annotation)/.test(normalizedUseCase)) {
		inferredCategories.add("commands");
	}

	if (/(kotlin|coroutine|async|thread)/.test(normalizedUseCase)) {
		inferredCategories.add("concurrency");
	}

	if (/(world|instance|chunk|save|persist|storage)/.test(normalizedUseCase)) {
		inferredCategories.add("world-storage");
	}

	if (
		/(ui|resourcepack|model|animation|particle|glyph|render)/.test(
			normalizedUseCase,
		)
	) {
		inferredCategories.add("models-and-ui");
	}

	if (/(combat|pvp|gameplay|entity)/.test(normalizedUseCase)) {
		inferredCategories.add("gameplay");
	}

	if (/(debug|visual|inspect|overlay)/.test(normalizedUseCase)) {
		inferredCategories.add("debugging");
	}

	return Array.from(inferredCategories);
}

function inferCategoryForLiveRepo(
	useCase: string,
	description: string,
	name: string,
): z.infer<typeof libraryCategorySchema> {
	const inferred = inferCategoriesFromUseCase(
		`${useCase} ${description} ${name}`,
	)[0];

	switch (inferred) {
		case "commands":
		case "concurrency":
		case "world-storage":
		case "models-and-ui":
		case "gameplay":
		case "debugging":
			return inferred;
		default:
			return "gameplay";
	}
}

function selectCuratedLibraries(
	useCase: string,
	category?: z.infer<typeof libraryCategorySchema>,
	environment?: z.infer<typeof environmentSummarySchema>,
) {
	const inferredCategories = category
		? [category]
		: inferCategoriesFromUseCase(useCase);
	const environmentCategories =
		environment?.detectedTopics.flatMap((entry) => {
			switch (entry.topic) {
				case "commands":
					return ["commands"];
				case "instances":
					return ["world-storage"];
				case "scheduler":
				case "threading":
					return ["concurrency"];
				case "events":
					return ["gameplay", "debugging"];
				default:
					return [];
			}
		}) ?? [];

	const existingLibraryNames = new Set(
		environment?.existingLibraries.map((library) =>
			library.fullName.toLowerCase(),
		) ?? [],
	);

	const rankedLibraries = curatedLibraries
		.filter((entry) => !category || entry.category === category)
		.map((entry) => ({
			entry,
			score:
				scoreTextQuery(useCase, [
					entry.name,
					entry.fullName,
					entry.category,
					entry.description,
					entry.rationale,
					...entry.tags,
					...entry.useCases,
				]) +
				(inferredCategories.includes(entry.category) ? 35 : 0) +
				(environmentCategories.includes(entry.category) ? 20 : 0) -
				(existingLibraryNames.has(entry.fullName.toLowerCase()) ? 25 : 0),
		}))
		.filter(
			({ entry, score }) =>
				score > 0 ||
				(category ? true : inferredCategories.includes(entry.category)),
		)
		.sort((left, right) => right.score - left.score)
		.map(({ entry }) => ({
			...entry,
			source: "curated" as const,
			sourceLinks: entry.officialLinks,
		}));

	const fallbackLibraries =
		rankedLibraries.length > 0
			? rankedLibraries
			: curatedLibraries.slice(0, 3).map((entry) => ({
					...entry,
					source: "curated" as const,
					sourceLinks: entry.officialLinks,
				}));

	return {
		inferredCategories,
		results: fallbackLibraries,
	};
}

async function fetchLiveLibraries(
	useCase: string,
	category?: z.infer<typeof libraryCategorySchema>,
) {
	const queryTokens = tokenize(useCase).slice(0, 5).join(" ");
	const query = queryTokens
		? `topic:minestom-library ${queryTokens}`
		: "topic:minestom-library";
	const endpoint = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=8`;

	const headers = new Headers({
		Accept: "application/vnd.github+json",
		"User-Agent": "minestom-mcp-server",
	});

	const authToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

	if (authToken) {
		headers.set("Authorization", `Bearer ${authToken}`);
	}

	try {
		const response = await fetch(endpoint, {
			headers,
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			return {
				results: [] as z.infer<typeof librarySuggestionSchema>[],
				warning: `Live Minestom library lookup failed with GitHub status ${response.status}. Returning curated results only.`,
			};
		}

		const payload = (await response.json()) as { items?: LiveRepository[] };

		const mappedResults = (payload.items ?? [])
			.map((repository) => {
				const description =
					repository.description ??
					"Live Minestom ecosystem result from GitHub.";
				const inferredCategory = inferCategoryForLiveRepo(
					useCase,
					description,
					repository.full_name,
				);

				return {
					category: inferredCategory,
					description,
					fullName: repository.full_name,
					name: repository.full_name.split("/").at(-1) ?? repository.full_name,
					rationale:
						"Returned from a live GitHub search for repositories tagged with the Minestom library topic.",
					repoUrl: repository.html_url,
					source: "live" as const,
					sourceLinks: [
						{
							kind: "ecosystem" as const,
							label: "Minestom Libraries",
							url: "https://minestom.net/libraries",
						},
						{
							kind: "github" as const,
							label: repository.full_name,
							url: repository.html_url,
						},
					],
					tags: tokenize(description),
				};
			})
			.filter((entry) => !category || entry.category === category);

		return {
			results: mappedResults,
			warning: undefined as string | undefined,
		};
	} catch (error) {
		return {
			results: [] as z.infer<typeof librarySuggestionSchema>[],
			warning:
				error instanceof Error
					? `Live Minestom library lookup failed: ${error.message}. Returning curated results only.`
					: "Live Minestom library lookup failed. Returning curated results only.",
		};
	}
}

export const suggestMinestomLibrariesTool: TanStackServerTool = toolDefinition({
	description:
		"Use this when you want Minestom ecosystem suggestions grounded in the official libraries directory, with optional live GitHub topic lookups.",
	inputSchema: suggestMinestomLibrariesInputSchema,
	name: "suggest_minestom_libraries",
	outputSchema: suggestMinestomLibrariesOutputSchema,
}).server(async (args) => {
	const { category, includeLiveResults, repoRoot, useCase } =
		suggestMinestomLibrariesInputSchema.parse(args);
	const environment = await inspectMinestomEnvironment(repoRoot).catch(
		() => undefined,
	);
	const curated = selectCuratedLibraries(useCase, category, environment);
	const live = includeLiveResults
		? await fetchLiveLibraries(useCase, category)
		: { results: [], warning: undefined };

	const mergedResults = uniqueBy(
		[...curated.results, ...live.results].filter(
			(entry) =>
				!environment?.existingLibraries.some(
					(library) =>
						library.repoUrl.toLowerCase() === entry.repoUrl.toLowerCase(),
				),
		),
		(entry) => entry.repoUrl.toLowerCase(),
	);

	return suggestMinestomLibrariesOutputSchema.parse({
		categoryFilter: category,
		curatedResults: curated.results,
		environment,
		liveResults: live.results,
		matchedCategories: uniqueBy(
			[
				...curated.inferredCategories.filter(
					(value): value is z.infer<typeof libraryCategorySchema> => {
						return (libraryCategorySchema.options as string[]).includes(value);
					},
				),
				...curated.results.map((entry) => entry.category),
				...live.results.map((entry) => entry.category),
			],
			(value) => value,
		),
		mergedResults,
		query: useCase,
		warning:
			live.warning ??
			(environment &&
			(!environment.jvmProject.isLikelyJvmProject ||
				environment.detectedTopics.length === 0)
				? "No strong JVM-backed Minestom repository signals were detected in the inspected environment; suggestions are primarily use-case driven."
				: undefined),
	});
});
