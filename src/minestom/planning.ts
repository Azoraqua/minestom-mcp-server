import { toolDefinition } from "@tanstack/ai";
import * as z from "zod/v4";
import type { TanStackServerTool } from "../tanstack-tools.js";
import { getApisBySymbols, getFeatureBlueprint } from "./catalog.js";
import {
	languageSchema,
	minestomFeatureTypeSchema,
	minestomTopicSchema,
	reviewAssessmentSchema,
} from "./schemas.js";

const planMinestomFeatureInputSchema = z.object({
	featureType: minestomFeatureTypeSchema.describe(
		"The kind of Minestom feature you want to plan.",
	),
	language: languageSchema
		.default("java")
		.describe("The target JVM language for the implementation."),
	packageName: z
		.string()
		.default("dev.example.minestom")
		.describe("Base package name for the generated outline."),
	targetName: z
		.string()
		.describe(
			"A short feature name such as SpawnCommand or LobbyJoinListener.",
		),
	useCases: z
		.array(z.string())
		.default([])
		.describe(
			"Optional behavior notes or acceptance criteria to fold into the plan.",
		),
});

const planMinestomFeatureOutputSchema = z.object({
	featureType: minestomFeatureTypeSchema,
	files: z.array(
		z.object({
			path: z.string(),
			purpose: z.string(),
		}),
	),
	implementationSteps: z.array(z.string()),
	keyApis: z.array(
		z.object({
			javadocUrl: z.string().url(),
			packageName: z.string(),
			symbol: z.string(),
		}),
	),
	primaryTopic: minestomTopicSchema,
	summary: z.string(),
	supportingTopics: z.array(minestomTopicSchema),
	threadSafetyNotes: z.array(z.string()),
	verificationSteps: z.array(z.string()),
});

export const planMinestomFeatureTool: TanStackServerTool = toolDefinition({
	description:
		"Use this when you want a Minestom feature plan grounded in official patterns for bootstrap, commands, events, instances, schedulers, and threading.",
	inputSchema: planMinestomFeatureInputSchema,
	name: "plan_minestom_feature",
	outputSchema: planMinestomFeatureOutputSchema,
}).server(async (args) => {
	const { featureType, language, packageName, targetName, useCases } =
		planMinestomFeatureInputSchema.parse(args);
	const blueprint = getFeatureBlueprint(featureType);
	const extension = language === "kotlin" ? "kt" : "java";
	const packagePath = packageName.replaceAll(".", "/");

	const files = blueprint.fileTemplates.map((template) => {
		const className = template.suffix
			? `${targetName}${template.suffix}`
			: targetName;

		return {
			path: `src/main/${language}/${packagePath}/${className}.${extension}`,
			purpose: template.purpose,
		};
	});

	const keyApis = getApisBySymbols(blueprint.keyApiSymbols).map((api) => ({
		javadocUrl: api.javadocUrl,
		packageName: api.packageName,
		symbol: api.symbol,
	}));

	const summary =
		useCases.length > 0
			? `${blueprint.summary} Prioritize these use cases: ${useCases.join("; ")}.`
			: blueprint.summary;

	return planMinestomFeatureOutputSchema.parse({
		featureType,
		files,
		implementationSteps: [
			...blueprint.implementationSteps,
			...(useCases.length > 0
				? [
						`Fold the requested behavior into the design without breaking the main Minestom ownership boundary: ${useCases.join("; ")}.`,
					]
				: []),
		],
		keyApis,
		primaryTopic: blueprint.primaryTopic,
		summary,
		supportingTopics: blueprint.supportingTopics,
		threadSafetyNotes: blueprint.threadSafetyNotes,
		verificationSteps: blueprint.verificationSteps,
	});
});

const reviewMinestomDesignInputSchema = z.object({
	designNotes: z
		.string()
		.describe(
			"Free-form design notes or a proposed implementation approach to review.",
		),
	featureType: minestomFeatureTypeSchema.describe(
		"The kind of Minestom feature the notes describe.",
	),
});

const reviewMinestomDesignOutputSchema = z.object({
	featureType: minestomFeatureTypeSchema,
	fitAssessment: reviewAssessmentSchema,
	gaps: z.array(z.string()),
	recommendedApis: z.array(
		z.object({
			javadocUrl: z.string().url(),
			packageName: z.string(),
			symbol: z.string(),
		}),
	),
	recommendedTopics: z.array(minestomTopicSchema),
	riskyAssumptions: z.array(z.string()),
	strengths: z.array(z.string()),
	threadTickConcerns: z.array(z.string()),
});

export const reviewMinestomDesignTool: TanStackServerTool = toolDefinition({
	description:
		"Use this when you want Minestom-specific design feedback that checks whether a proposed feature aligns with the platform’s manager, instance, event, scheduler, and threading patterns.",
	inputSchema: reviewMinestomDesignInputSchema,
	name: "review_minestom_design",
	outputSchema: reviewMinestomDesignOutputSchema,
}).server(async (args) => {
	const { designNotes, featureType } =
		reviewMinestomDesignInputSchema.parse(args);
	const blueprint = getFeatureBlueprint(featureType);
	const loweredNotes = designNotes.toLowerCase();

	const strengths = blueprint.designChecks
		.filter((check) =>
			check.keywords.some((keyword) => loweredNotes.includes(keyword)),
		)
		.map((check) => check.strength);

	const gaps = blueprint.designChecks
		.filter(
			(check) =>
				!check.keywords.some((keyword) => loweredNotes.includes(keyword)),
		)
		.map((check) => check.gap);

	const riskyAssumptions: string[] = [];

	if (
		loweredNotes.includes("async") &&
		!/(acquirable|scheduler|taskschedule|executiontype|sync)/.test(loweredNotes)
	) {
		riskyAssumptions.push(
			"The design mentions async work without explaining how Minestom-owned state is reacquired or handed back safely.",
		);
	}

	if (
		featureType === "instance-setup" &&
		loweredNotes.includes("per-player") &&
		!loweredNotes.includes("sharedinstance")
	) {
		riskyAssumptions.push(
			"Per-player world semantics are mentioned without clarifying whether `SharedInstance` or a separate `InstanceContainer` owns that state.",
		);
	}

	if (
		featureType === "scheduled-task" &&
		!/(cancel|shutdown|stop)/.test(loweredNotes)
	) {
		riskyAssumptions.push(
			"The design does not explain who cancels or tears down the scheduled task when the feature stops.",
		);
	}

	if (
		featureType === "server-bootstrap" &&
		!/(instance|spawn|asyncplayerconfigurationevent)/.test(loweredNotes)
	) {
		riskyAssumptions.push(
			"The bootstrap notes do not make the initial player-to-instance flow explicit.",
		);
	}

	const fitAssessment =
		strengths.length >= Math.max(blueprint.designChecks.length - 1, 2)
			? "strong"
			: strengths.length >= 2
				? "partial"
				: "weak";

	const recommendedApis = getApisBySymbols(blueprint.keyApiSymbols).map(
		(api) => ({
			javadocUrl: api.javadocUrl,
			packageName: api.packageName,
			symbol: api.symbol,
		}),
	);

	return reviewMinestomDesignOutputSchema.parse({
		featureType,
		fitAssessment,
		gaps,
		recommendedApis,
		recommendedTopics: [blueprint.primaryTopic, ...blueprint.supportingTopics],
		riskyAssumptions,
		strengths,
		threadTickConcerns: blueprint.threadSafetyNotes,
	});
});
