import { toolDefinition } from "@tanstack/ai";
import * as z from "zod/v4";
import type { TanStackServerTool } from "../tanstack-tools.js";
import { apiCatalog, getApisForTopic, getTopicEntry } from "./catalog.js";
import {
	apiReferenceSchema,
	minestomTopicSchema,
	officialLinkSchema,
} from "./schemas.js";
import { scoreTextQuery } from "./search.js";

const explainMinestomPatternInputSchema = z.object({
	goal: z
		.string()
		.optional()
		.describe(
			"Optional goal or problem statement to tailor the pattern explanation.",
		),
	topic: minestomTopicSchema.describe(
		"The Minestom subsystem or design topic to explain.",
	),
});

const explainMinestomPatternOutputSchema = z.object({
	commonPitfalls: z.array(z.string()),
	explanation: z.string(),
	goalAdjustment: z.string().optional(),
	keyApis: z.array(
		z.object({
			javadocUrl: z.string().url(),
			packageName: z.string(),
			symbol: z.string(),
		}),
	),
	lifecycleNotes: z.array(z.string()),
	officialLinks: z.array(officialLinkSchema),
	summary: z.string(),
	title: z.string(),
	topic: minestomTopicSchema,
});

export const explainMinestomPatternTool: TanStackServerTool = toolDefinition({
	description:
		"Use this when you want a docs-backed explanation of how Minestom typically models bootstrap, instances, events, commands, schedulers, or thread ownership.",
	inputSchema: explainMinestomPatternInputSchema,
	name: "explain_minestom_pattern",
	outputSchema: explainMinestomPatternOutputSchema,
}).server(async (args) => {
	const { goal, topic } = explainMinestomPatternInputSchema.parse(args);
	const topicEntry = getTopicEntry(topic);
	const keyApis = getApisForTopic(topic)
		.slice(0, 5)
		.map((api) => ({
			javadocUrl: api.javadocUrl,
			packageName: api.packageName,
			symbol: api.symbol,
		}));

	const goalAdjustment = goal
		? `For goal "${goal}", start with ${topicEntry.keyApiSymbols.slice(0, 2).join(" and ")} and keep the ${topic} ownership model explicit.`
		: undefined;

	return explainMinestomPatternOutputSchema.parse({
		commonPitfalls: topicEntry.commonPitfalls,
		explanation: topicEntry.explanation,
		goalAdjustment,
		keyApis,
		lifecycleNotes: topicEntry.lifecycleNotes,
		officialLinks: topicEntry.officialLinks,
		summary: topicEntry.summary,
		title: topicEntry.title,
		topic,
	});
});

const lookupMinestomApiInputSchema = z.object({
	symbol: z
		.string()
		.describe(
			"Class, interface, or API symbol to look up, such as EventNode or SchedulerManager.",
		),
	topic: minestomTopicSchema
		.optional()
		.describe(
			"Optional topic filter to keep the lookup scoped to one Minestom subsystem.",
		),
});

const lookupMinestomApiOutputSchema = z.object({
	bestMatches: z.array(apiReferenceSchema),
	query: z.string(),
	topicFilter: minestomTopicSchema.optional(),
	warning: z.string().optional(),
});

export const lookupMinestomApiTool: TanStackServerTool = toolDefinition({
	description:
		"Use this when you need curated Minestom API matches with package names, why they matter, related APIs, and javadoc links.",
	inputSchema: lookupMinestomApiInputSchema,
	name: "lookup_minestom_api",
	outputSchema: lookupMinestomApiOutputSchema,
}).server(async (args) => {
	const { symbol, topic } = lookupMinestomApiInputSchema.parse(args);
	const candidates = apiCatalog.filter(
		(entry) => !topic || entry.topic === topic,
	);

	const rankedMatches = candidates
		.map((entry) => ({
			entry,
			score: scoreTextQuery(symbol, [
				entry.symbol,
				entry.displayName,
				entry.packageName,
				entry.summary,
				entry.whyItMatters,
				...entry.relatedSymbols,
				...entry.keywords,
			]),
		}))
		.filter(({ score }) => score > 0)
		.sort((left, right) => right.score - left.score)
		.slice(0, 5)
		.map(({ entry }) => entry);

	const fallbackMatches =
		rankedMatches.length > 0
			? rankedMatches
			: candidates.slice(0, Math.min(3, candidates.length));

	const warning =
		rankedMatches.length > 0
			? undefined
			: topic
				? `No strong curated API match for "${symbol}" under ${topic}; returning the main APIs for that topic instead.`
				: `No strong curated API match for "${symbol}" was found; returning the first curated Minestom APIs instead.`;

	return lookupMinestomApiOutputSchema.parse({
		bestMatches: fallbackMatches,
		query: symbol,
		topicFilter: topic,
		warning,
	});
});
