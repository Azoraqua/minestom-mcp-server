import { toolDefinition } from "@tanstack/ai";
import * as z from "zod/v4";
import packageJson from "../../package.json" with { type: "json" };
import type { TanStackServerTool } from "../tanstack-tools.js";
import { knowledgeCatalogMeta } from "./catalog.js";
import { minestomTopicSchema, officialLinkSchema } from "./schemas.js";

const pingInputSchema = z.object({
	message: z
		.string()
		.optional()
		.describe("Optional text to echo back in the response."),
});

const pingOutputSchema = z.object({
	echoedMessage: z.string(),
	ok: z.boolean(),
	timestamp: z.string(),
});

export const pingTool: TanStackServerTool = toolDefinition({
	description:
		"Use this when you want to verify that the Minestom MCP server is reachable.",
	inputSchema: pingInputSchema,
	name: "ping",
	outputSchema: pingOutputSchema,
}).server(async (args) => {
	const { message } = pingInputSchema.parse(args);

	return pingOutputSchema.parse({
		echoedMessage: message ?? "pong",
		ok: true,
		timestamp: new Date().toISOString(),
	});
});

const getServerInfoInputSchema = z.object({
	includeDependencies: z
		.boolean()
		.default(false)
		.describe(
			"Whether to include runtime dependency versions in the response.",
		),
});

const getServerInfoOutputSchema = z.object({
	availableTools: z.array(z.string()),
	dependencies: z.record(z.string(), z.string()).optional(),
	description: z.string(),
	knowledgeCatalog: z.object({
		coveredTopics: z.array(minestomTopicSchema),
		environmentAwareTools: z.array(z.string()),
		supportsLiveLibraryLookup: z.boolean(),
		updatedOn: z.string(),
		version: z.string(),
	}),
	name: z.string(),
	officialSources: z.array(officialLinkSchema),
	runtime: z.object({
		node: z.string(),
		platform: z.string(),
	}),
	toolCount: z.number().int(),
	version: z.string(),
});

export function createGetServerInfoTool(
	getToolNames: () => string[],
): TanStackServerTool {
	return toolDefinition({
		description:
			"Use this when you need package metadata, runtime details, tool inventory, or knowledge-catalog coverage for this Minestom MCP server.",
		inputSchema: getServerInfoInputSchema,
		name: "get_server_info",
		outputSchema: getServerInfoOutputSchema,
	}).server(async (args) => {
		const { includeDependencies } = getServerInfoInputSchema.parse(args);
		const availableTools = getToolNames();

		return getServerInfoOutputSchema.parse({
			availableTools,
			dependencies: includeDependencies ? packageJson.dependencies : undefined,
			description: packageJson.description,
			knowledgeCatalog: {
				coveredTopics: knowledgeCatalogMeta.coveredTopics,
				environmentAwareTools: [
					"inspect_minestom_environment",
					"inspect_minestom_build",
					"suggest_minestom_libraries",
				],
				supportsLiveLibraryLookup:
					knowledgeCatalogMeta.supportsLiveLibraryLookup,
				updatedOn: knowledgeCatalogMeta.updatedOn,
				version: knowledgeCatalogMeta.version,
			},
			name: packageJson.name,
			officialSources: knowledgeCatalogMeta.officialSources,
			runtime: {
				node: process.version,
				platform: process.platform,
			},
			toolCount: availableTools.length,
			version: packageJson.version,
		});
	});
}
