import type {
	LibraryCategory,
	MinestomFeatureType,
	MinestomTopic,
	OfficialLink,
} from "./schemas.js";

export type MinestomApiEntry = {
	displayName: string;
	javadocUrl: string;
	kind: string;
	officialLinks: OfficialLink[];
	packageName: string;
	relatedSymbols: string[];
	summary: string;
	symbol: string;
	topic: MinestomTopic;
	whyItMatters: string;
	keywords: string[];
};

export type MinestomTopicEntry = {
	commonPitfalls: string[];
	explanation: string;
	keyApiSymbols: string[];
	lifecycleNotes: string[];
	officialLinks: OfficialLink[];
	summary: string;
	title: string;
};

export type CuratedLibraryEntry = {
	category: LibraryCategory;
	description: string;
	fullName: string;
	name: string;
	officialLinks: OfficialLink[];
	rationale: string;
	repoUrl: string;
	tags: string[];
	useCases: string[];
};

type FeatureBlueprint = {
	designChecks: Array<{
		gap: string;
		keywords: string[];
		strength: string;
	}>;
	fileTemplates: Array<{
		purpose: string;
		suffix: string;
	}>;
	implementationSteps: string[];
	keyApiSymbols: string[];
	primaryTopic: MinestomTopic;
	summary: string;
	supportingTopics: MinestomTopic[];
	threadSafetyNotes: string[];
	verificationSteps: string[];
};

const introLink: OfficialLink = {
	kind: "docs",
	label: "Minestom Introduction",
	url: "https://minestom.net/docs/introduction",
};

const dependenciesLink: OfficialLink = {
	kind: "docs",
	label: "Setup Dependencies",
	url: "https://minestom.net/docs/setup/dependencies",
};

const firstServerLink: OfficialLink = {
	kind: "docs",
	label: "Your First Server",
	url: "https://minestom.net/docs/setup/your-first-server",
};

const instancesLink: OfficialLink = {
	kind: "docs",
	label: "Instances Guide",
	url: "https://minestom.net/docs/world/instances",
};

const eventsLink: OfficialLink = {
	kind: "docs",
	label: "Events Guide",
	url: "https://minestom.net/docs/feature/events",
};

const commandsLink: OfficialLink = {
	kind: "docs",
	label: "Commands Guide",
	url: "https://minestom.net/docs/feature/commands",
};

const schedulersLink: OfficialLink = {
	kind: "docs",
	label: "Schedulers Guide",
	url: "https://minestom.net/docs/feature/schedulers",
};

const acquirableDocsLink: OfficialLink = {
	kind: "docs",
	label: "Acquirable API",
	url: "https://minestom.net/docs/thread-architecture/acquirable-api",
};

const librariesLink: OfficialLink = {
	kind: "ecosystem",
	label: "Minestom Libraries",
	url: "https://minestom.net/libraries",
};

const javadocsRootLink: OfficialLink = {
	kind: "javadoc",
	label: "Minestom Javadocs",
	url: "https://javadoc.minestom.net",
};

export const knowledgeCatalogMeta = {
	coveredTopics: [
		"bootstrap",
		"instances",
		"events",
		"commands",
		"scheduler",
		"threading",
	] as MinestomTopic[],
	officialSources: [introLink, javadocsRootLink, librariesLink],
	supportsLiveLibraryLookup: true,
	updatedOn: "2026-03-15",
	version: "2026.03.15",
};

export const topicCatalog: Record<MinestomTopic, MinestomTopicEntry> = {
	bootstrap: {
		commonPitfalls: [
			"Starting the server before commands, events, and instances are registered.",
			"Treating bootstrap as ad-hoc global state instead of manager wiring.",
			"Forgetting the Java and dependency expectations from Minestom setup docs.",
		],
		explanation:
			"Minestom expects a manager-first bootstrap: initialize once, wire global managers and handlers, then start the server when gameplay systems are ready.",
		keyApiSymbols: [
			"MinecraftServer",
			"ServerProcess",
			"InstanceManager",
			"CommandManager",
			"GlobalEventHandler",
		],
		lifecycleNotes: [
			"Call `MinecraftServer.init()` before using Minestom managers.",
			"Create or register the instances players can join before calling `start(...)`.",
			"Keep command, event, and instance registration in bootstrap so ownership is obvious.",
		],
		officialLinks: [
			introLink,
			dependenciesLink,
			firstServerLink,
			javadocsRootLink,
		],
		summary:
			"Bootstrap in Minestom is about initializing the server process and wiring managers in a predictable order.",
		title: "Bootstrap and Manager Wiring",
	},
	commands: {
		commonPitfalls: [
			"Putting parsing, validation, and gameplay mutations in one giant executor.",
			"Skipping syntax definitions and relying on manual string parsing.",
			"Doing blocking or cross-thread state mutations directly inside command execution.",
		],
		explanation:
			"Commands in Minestom are syntax-oriented builders registered through the command manager. The clean pattern is to keep command registration thin and move gameplay effects into services.",
		keyApiSymbols: [
			"CommandManager",
			"Command",
			"CommandContext",
			"ArgumentType",
		],
		lifecycleNotes: [
			"Register commands during bootstrap, not lazily during player activity.",
			"Define syntaxes and argument parsing before attaching side effects.",
			"If command execution fans out to async work, hand state mutations back to Minestom-owned threads.",
		],
		officialLinks: [commandsLink, javadocsRootLink],
		summary:
			"Minestom commands are built around explicit syntax and argument definitions rather than free-form parsing.",
		title: "Command Syntax and Registration",
	},
	events: {
		commonPitfalls: [
			"Registering every listener on one giant global node with no structure.",
			"Doing blocking work directly in event callbacks.",
			"Mutating shared state in listeners without thinking about ownership and filtering.",
		],
		explanation:
			"Minestom event handling is centered on `EventNode` trees. Use filtering and hierarchy to keep listener ownership clear instead of piling everything into one flat callback list.",
		keyApiSymbols: [
			"EventNode",
			"GlobalEventHandler",
			"EventFilter",
			"EventListener",
		],
		lifecycleNotes: [
			"Build nodes around ownership boundaries such as instances, entities, or gameplay systems.",
			"Attach child nodes to keep related listeners grouped and removable together.",
			"Offload expensive work from listeners and re-enter Minestom state safely afterward.",
		],
		officialLinks: [eventsLink, javadocsRootLink],
		summary:
			"The preferred Minestom event pattern is a structured event-node tree, not an unscoped global pile of callbacks.",
		title: "EventNode Trees and Listener Ownership",
	},
	instances: {
		commonPitfalls: [
			"Creating instances without documenting how players are assigned to them.",
			"Mixing world generation, spawn rules, and player assignment logic in one class.",
			"Using shared instances or generators without stating the intended ownership model.",
		],
		explanation:
			"Instances are Minestom’s core world primitive. Keep instance construction, generator configuration, and player assignment explicit so world behavior remains composable.",
		keyApiSymbols: [
			"InstanceManager",
			"Instance",
			"InstanceContainer",
			"SharedInstance",
			"Generator",
		],
		lifecycleNotes: [
			"Create or retrieve instances through the instance manager during bootstrap or controlled world setup flows.",
			"Separate generator/world rules from player configuration and spawn handling.",
			"Choose between `InstanceContainer` and `SharedInstance` deliberately based on isolation needs.",
		],
		officialLinks: [instancesLink, firstServerLink, javadocsRootLink],
		summary:
			"Instances define world state and player placement. Clear instance ownership is one of the main architectural choices in Minestom.",
		title: "Instances, World Setup, and Player Placement",
	},
	scheduler: {
		commonPitfalls: [
			"Scheduling repeated work without documenting cancellation or shutdown behavior.",
			"Treating async and tick-bound tasks as interchangeable.",
			"Mutating Minestom-owned state from async tasks without a safe handoff.",
		],
		explanation:
			"Minestom’s scheduler is the right place for tick-bound repetition and controlled async work. The important pattern is to choose execution type intentionally and document cancellation behavior.",
		keyApiSymbols: [
			"ServerProcess",
			"SchedulerManager",
			"Task",
			"TaskSchedule",
			"ExecutionType",
		],
		lifecycleNotes: [
			"Create tasks from the scheduler manager instead of inventing parallel timing infrastructure.",
			"State whether a task is tick-bound, delayed, repeated, or async.",
			"Pair long-lived tasks with explicit shutdown or cancellation ownership.",
		],
		officialLinks: [schedulersLink, javadocsRootLink],
		summary:
			"Schedulers in Minestom are for predictable tick and async orchestration, with execution type and cancellation made explicit.",
		title: "Schedulers, Task Lifetimes, and Tick Work",
	},
	threading: {
		commonPitfalls: [
			"Assuming you can mutate players, instances, or entities from arbitrary async threads.",
			"Using async work without a reacquisition strategy.",
			"Ignoring Minestom’s ownership model when sharing state across tasks and listeners.",
		],
		explanation:
			"Minestom exposes threading boundaries explicitly. `Acquirable` is the main signal that state has an ownership model and must be reacquired or synchronized before mutation.",
		keyApiSymbols: [
			"Acquirable",
			"AcquirableCollection",
			"SchedulerManager",
			"ExecutionType",
		],
		lifecycleNotes: [
			"Treat Minestom-owned objects as thread-owned and reacquire them before mutation after async work.",
			"Combine scheduler handoff and acquirable APIs when crossing thread boundaries.",
			"Document ownership assumptions anywhere gameplay systems mix async I/O with world state.",
		],
		officialLinks: [acquirableDocsLink, javadocsRootLink],
		summary:
			"Threading in Minestom is explicit. Ownership and reacquisition are part of the design, not an afterthought.",
		title: "Thread Ownership and Acquirable State",
	},
};

export const apiCatalog: MinestomApiEntry[] = [
	{
		displayName: "MinecraftServer",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/MinecraftServer.html",
		kind: "class",
		keywords: ["init", "start", "bootstrap", "managers", "entrypoint"],
		officialLinks: [firstServerLink, introLink, javadocsRootLink],
		packageName: "net.minestom.server",
		relatedSymbols: [
			"ServerProcess",
			"InstanceManager",
			"CommandManager",
			"GlobalEventHandler",
		],
		summary:
			"Static bootstrap entrypoint used to initialize and start a Minestom server.",
		symbol: "MinecraftServer",
		topic: "bootstrap",
		whyItMatters:
			"Nearly every Minestom server begins here, so this defines startup order and access to the main managers.",
	},
	{
		displayName: "ServerProcess",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/ServerProcess.html",
		kind: "interface",
		keywords: ["process", "scheduler", "dispatcher", "server lifetime"],
		officialLinks: [introLink, javadocsRootLink],
		packageName: "net.minestom.server",
		relatedSymbols: ["MinecraftServer", "SchedulerManager"],
		summary:
			"Aggregates core server subsystems such as scheduling and processing.",
		symbol: "ServerProcess",
		topic: "bootstrap",
		whyItMatters:
			"Useful when reasoning about global scheduling and server-level orchestration beyond a single manager.",
	},
	{
		displayName: "InstanceManager",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/instance/InstanceManager.html",
		kind: "manager",
		keywords: ["instances", "worlds", "register", "create instance"],
		officialLinks: [instancesLink, javadocsRootLink],
		packageName: "net.minestom.server.instance",
		relatedSymbols: ["InstanceContainer", "SharedInstance", "MinecraftServer"],
		summary: "Creates and tracks the instances available to the server.",
		symbol: "InstanceManager",
		topic: "bootstrap",
		whyItMatters:
			"Bootstrap usually becomes clearer when instance lifecycle stays behind this manager.",
	},
	{
		displayName: "CommandManager",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/command/CommandManager.html",
		kind: "manager",
		keywords: ["commands", "register", "syntax", "manager"],
		officialLinks: [commandsLink, javadocsRootLink],
		packageName: "net.minestom.server.command",
		relatedSymbols: ["Command", "CommandContext", "ArgumentType"],
		summary: "Registers command builders and routes command execution.",
		symbol: "CommandManager",
		topic: "commands",
		whyItMatters:
			"This is the stable registration point for a command surface that grows over time.",
	},
	{
		displayName: "GlobalEventHandler",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/event/GlobalEventHandler.html",
		kind: "handler",
		keywords: ["events", "global", "root node", "listeners"],
		officialLinks: [eventsLink, javadocsRootLink],
		packageName: "net.minestom.server.event",
		relatedSymbols: ["EventNode", "EventListener", "MinecraftServer"],
		summary: "Global event entrypoint used to attach root listeners and nodes.",
		symbol: "GlobalEventHandler",
		topic: "events",
		whyItMatters:
			"Most event trees start here before being split into child nodes by subsystem or ownership.",
	},
	{
		displayName: "Instance",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/instance/Instance.html",
		kind: "interface",
		keywords: ["world", "instance", "players", "blocks"],
		officialLinks: [instancesLink, javadocsRootLink],
		packageName: "net.minestom.server.instance",
		relatedSymbols: ["InstanceContainer", "SharedInstance", "Generator"],
		summary:
			"Base world abstraction implemented by concrete Minestom instance types.",
		symbol: "Instance",
		topic: "instances",
		whyItMatters:
			"This is the core contract for world ownership, player placement, and block/entity interactions.",
	},
	{
		displayName: "InstanceContainer",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/instance/InstanceContainer.html",
		kind: "class",
		keywords: ["world", "instance container", "chunk generator", "spawn world"],
		officialLinks: [instancesLink, firstServerLink, javadocsRootLink],
		packageName: "net.minestom.server.instance",
		relatedSymbols: [
			"Instance",
			"SharedInstance",
			"Generator",
			"InstanceManager",
		],
		summary:
			"Concrete instance implementation used for standalone world state and generation.",
		symbol: "InstanceContainer",
		topic: "instances",
		whyItMatters:
			"This is the usual starting point for defining playable worlds and their generators.",
	},
	{
		displayName: "SharedInstance",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/instance/SharedInstance.html",
		kind: "class",
		keywords: [
			"shared instance",
			"clone world",
			"per player world",
			"delegation",
		],
		officialLinks: [instancesLink, javadocsRootLink],
		packageName: "net.minestom.server.instance",
		relatedSymbols: ["InstanceContainer", "InstanceManager"],
		summary:
			"Instance type that shares chunks or state patterns from a parent world.",
		symbol: "SharedInstance",
		topic: "instances",
		whyItMatters:
			"Useful when you need world isolation semantics without rebuilding every chunk pipeline from scratch.",
	},
	{
		displayName: "Generator",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/instance/generator/Generator.html",
		kind: "interface",
		keywords: ["generator", "world generation", "chunks", "terrain"],
		officialLinks: [instancesLink, javadocsRootLink],
		packageName: "net.minestom.server.instance.generator",
		relatedSymbols: ["InstanceContainer", "Instance"],
		summary:
			"World generation contract used to populate chunks in an instance container.",
		symbol: "Generator",
		topic: "instances",
		whyItMatters:
			"Generation logic belongs here so world rules stay separate from player configuration and instance wiring.",
	},
	{
		displayName: "EventNode",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/event/EventNode.html",
		kind: "class",
		keywords: ["event node", "tree", "filter", "child node"],
		officialLinks: [eventsLink, javadocsRootLink],
		packageName: "net.minestom.server.event",
		relatedSymbols: ["GlobalEventHandler", "EventFilter", "EventListener"],
		summary:
			"Composable event tree primitive used to scope and filter listeners.",
		symbol: "EventNode",
		topic: "events",
		whyItMatters:
			"This is the main architectural tool for keeping event ownership clean in Minestom.",
	},
	{
		displayName: "EventFilter",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/event/EventFilter.html",
		kind: "interface",
		keywords: ["event filter", "filter", "owner", "node"],
		officialLinks: [eventsLink, javadocsRootLink],
		packageName: "net.minestom.server.event",
		relatedSymbols: ["EventNode", "GlobalEventHandler"],
		summary:
			"Filter abstraction used to target nodes and listeners at specific owners or event families.",
		symbol: "EventFilter",
		topic: "events",
		whyItMatters:
			"Event filters are how Minestom keeps event trees targeted instead of globally noisy.",
	},
	{
		displayName: "EventListener",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/event/EventListener.html",
		kind: "interface",
		keywords: ["event listener", "callback", "expiration", "filter"],
		officialLinks: [eventsLink, javadocsRootLink],
		packageName: "net.minestom.server.event",
		relatedSymbols: ["EventNode", "GlobalEventHandler"],
		summary:
			"Listener wrapper that supports richer event handling than a raw callback alone.",
		symbol: "EventListener",
		topic: "events",
		whyItMatters:
			"Helpful when you need event logic with conditions, expiry, or other lifecycle behavior.",
	},
	{
		displayName: "Command",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/command/builder/Command.html",
		kind: "builder",
		keywords: ["command builder", "syntax", "executor", "condition"],
		officialLinks: [commandsLink, javadocsRootLink],
		packageName: "net.minestom.server.command.builder",
		relatedSymbols: ["CommandManager", "CommandContext", "ArgumentType"],
		summary:
			"Command builder used to define syntaxes, executors, and conditions.",
		symbol: "Command",
		topic: "commands",
		whyItMatters:
			"Minestom commands are meant to be modeled as syntax trees, and this builder is where that shape lives.",
	},
	{
		displayName: "CommandContext",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/command/builder/CommandContext.html",
		kind: "context",
		keywords: ["context", "arguments", "parsed values", "command execution"],
		officialLinks: [commandsLink, javadocsRootLink],
		packageName: "net.minestom.server.command.builder",
		relatedSymbols: ["Command", "ArgumentType", "CommandManager"],
		summary:
			"Holds parsed arguments and execution context for a command invocation.",
		symbol: "CommandContext",
		topic: "commands",
		whyItMatters:
			"Use this instead of reparsing raw input so command logic stays aligned with defined syntaxes.",
	},
	{
		displayName: "ArgumentType",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/command/builder/arguments/ArgumentType.html",
		kind: "factory",
		keywords: ["argument", "argument type", "parser", "syntax"],
		officialLinks: [commandsLink, javadocsRootLink],
		packageName: "net.minestom.server.command.builder.arguments",
		relatedSymbols: ["Argument", "Command", "CommandContext"],
		summary:
			"Factory entrypoint for the argument types used in command syntaxes.",
		symbol: "ArgumentType",
		topic: "commands",
		whyItMatters:
			"This keeps command parsing declarative instead of hard-coded into executors.",
	},
	{
		displayName: "Argument",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/command/builder/arguments/Argument.html",
		kind: "abstract class",
		keywords: ["argument", "syntax node", "command parameter"],
		officialLinks: [commandsLink, javadocsRootLink],
		packageName: "net.minestom.server.command.builder.arguments",
		relatedSymbols: ["ArgumentType", "Command", "CommandContext"],
		summary:
			"Base command-argument abstraction used inside Minestom command syntax trees.",
		symbol: "Argument",
		topic: "commands",
		whyItMatters:
			"Understanding this type helps when you need custom or advanced command parsing behavior.",
	},
	{
		displayName: "SchedulerManager",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/timer/SchedulerManager.html",
		kind: "manager",
		keywords: ["scheduler", "tasks", "delay", "repeat"],
		officialLinks: [schedulersLink, javadocsRootLink],
		packageName: "net.minestom.server.timer",
		relatedSymbols: ["Task", "TaskSchedule", "ExecutionType", "ServerProcess"],
		summary: "Central manager for creating and coordinating scheduled work.",
		symbol: "SchedulerManager",
		topic: "scheduler",
		whyItMatters:
			"This is the stable entrypoint for tick-bound and delayed work instead of ad-hoc timing utilities.",
	},
	{
		displayName: "Task",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/timer/Task.html",
		kind: "interface",
		keywords: ["task", "scheduled work", "cancel", "lifecycle"],
		officialLinks: [schedulersLink, javadocsRootLink],
		packageName: "net.minestom.server.timer",
		relatedSymbols: ["SchedulerManager", "TaskSchedule"],
		summary:
			"Represents a scheduled piece of work that can be tracked or cancelled.",
		symbol: "Task",
		topic: "scheduler",
		whyItMatters:
			"Task lifetimes matter in Minestom because repeated work should be explicit about cancellation and ownership.",
	},
	{
		displayName: "TaskSchedule",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/timer/TaskSchedule.html",
		kind: "value type",
		keywords: ["task schedule", "tick delay", "repeat", "timing"],
		officialLinks: [schedulersLink, javadocsRootLink],
		packageName: "net.minestom.server.timer",
		relatedSymbols: ["Task", "SchedulerManager", "ExecutionType"],
		summary: "Defines how scheduled work is delayed, repeated, or stopped.",
		symbol: "TaskSchedule",
		topic: "scheduler",
		whyItMatters:
			"Good Minestom scheduler code makes timing semantics explicit through schedules, not hidden constants.",
	},
	{
		displayName: "ExecutionType",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/timer/ExecutionType.html",
		kind: "enum",
		keywords: ["execution type", "sync", "async", "scheduler"],
		officialLinks: [schedulersLink, acquirableDocsLink, javadocsRootLink],
		packageName: "net.minestom.server.timer",
		relatedSymbols: ["SchedulerManager", "TaskSchedule", "Acquirable"],
		summary: "Scheduler execution mode describing where and how a task runs.",
		symbol: "ExecutionType",
		topic: "scheduler",
		whyItMatters:
			"Execution type is the bridge between scheduler design and Minestom’s ownership model.",
	},
	{
		displayName: "Acquirable",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/thread/Acquirable.html",
		kind: "interface",
		keywords: ["acquirable", "thread ownership", "sync", "reacquire"],
		officialLinks: [acquirableDocsLink, javadocsRootLink],
		packageName: "net.minestom.server.thread",
		relatedSymbols: [
			"AcquirableCollection",
			"SchedulerManager",
			"ExecutionType",
		],
		summary:
			"Thread-ownership abstraction for state that must be reacquired before safe mutation.",
		symbol: "Acquirable",
		topic: "threading",
		whyItMatters:
			"This is Minestom’s clearest signal that asynchronous work must respect ownership boundaries.",
	},
	{
		displayName: "AcquirableCollection",
		javadocUrl:
			"https://javadoc.minestom.net/net.minestom.server/net/minestom/server/thread/AcquirableCollection.html",
		kind: "class",
		keywords: ["acquirable collection", "batch ownership", "group reacquire"],
		officialLinks: [acquirableDocsLink, javadocsRootLink],
		packageName: "net.minestom.server.thread",
		relatedSymbols: ["Acquirable", "ExecutionType"],
		summary:
			"Utility for handling ownership across multiple acquirable values together.",
		symbol: "AcquirableCollection",
		topic: "threading",
		whyItMatters:
			"Useful when async workflows need to re-enter more than one Minestom-owned object safely.",
	},
];

export const curatedLibraries: CuratedLibraryEntry[] = [
	{
		category: "commands",
		description:
			"A modern annotations-driven commands framework for Java and Kotlin.",
		fullName: "Revxrsal/Lamp",
		name: "Lamp",
		officialLinks: [
			librariesLink,
			{
				kind: "github",
				label: "Revxrsal/Lamp",
				url: "https://github.com/Revxrsal/Lamp",
			},
		],
		rationale:
			"Good fit when Minestom’s native syntax builders feel too low-level and you want an annotation-heavy command layer.",
		repoUrl: "https://github.com/Revxrsal/Lamp",
		tags: ["commands", "annotations", "java", "kotlin"],
		useCases: [
			"command framework",
			"annotation commands",
			"command ergonomics",
		],
	},
	{
		category: "concurrency",
		description:
			"Adds extensive coroutine support for Minecraft server environments, including Minestom-friendly Kotlin workflows.",
		fullName: "Shynixn/MCCoroutine",
		name: "MCCoroutine",
		officialLinks: [
			librariesLink,
			{
				kind: "github",
				label: "Shynixn/MCCoroutine",
				url: "https://github.com/Shynixn/MCCoroutine",
			},
		],
		rationale:
			"Useful when a Minestom codebase is Kotlin-heavy and wants structured async flows instead of callback chains.",
		repoUrl: "https://github.com/Shynixn/MCCoroutine",
		tags: ["kotlin", "coroutines", "async", "concurrency"],
		useCases: [
			"kotlin coroutines",
			"async orchestration",
			"structured concurrency",
		],
	},
	{
		category: "models-and-ui",
		description:
			"Render, animate and interact with custom entity models in Minecraft: Java Edition servers.",
		fullName: "unnamed/hephaestus-engine",
		name: "Hephaestus Engine",
		officialLinks: [
			librariesLink,
			{
				kind: "github",
				label: "unnamed/hephaestus-engine",
				url: "https://github.com/unnamed/hephaestus-engine",
			},
		],
		rationale:
			"A strong candidate when your Minestom server needs custom models and richer in-game presentation.",
		repoUrl: "https://github.com/unnamed/hephaestus-engine",
		tags: ["models", "animation", "entities", "rendering"],
		useCases: ["custom models", "entity animation", "presentation layer"],
	},
	{
		category: "world-storage",
		description: "Fast and small world format for Minestom.",
		fullName: "hollow-cube/polar",
		name: "Polar",
		officialLinks: [
			librariesLink,
			{
				kind: "github",
				label: "hollow-cube/polar",
				url: "https://github.com/hollow-cube/polar",
			},
		],
		rationale:
			"Useful when your instance strategy needs portable or compact world persistence tailored for Minestom.",
		repoUrl: "https://github.com/hollow-cube/polar",
		tags: ["world format", "persistence", "instances", "storage"],
		useCases: ["world persistence", "instance storage", "world serialization"],
	},
	{
		category: "models-and-ui",
		description:
			"A modern, resourcepack based fullscreen UI plugin and library.",
		fullName: "Combimagnetron/Sunscreen",
		name: "Sunscreen",
		officialLinks: [
			librariesLink,
			{
				kind: "github",
				label: "Combimagnetron/Sunscreen",
				url: "https://github.com/Combimagnetron/Sunscreen",
			},
		],
		rationale:
			"Useful for resource-pack-driven interfaces when chat messages and boss bars are not enough.",
		repoUrl: "https://github.com/Combimagnetron/Sunscreen",
		tags: ["ui", "resourcepack", "fullscreen", "presentation"],
		useCases: ["fullscreen ui", "resourcepack ui", "custom interface"],
	},
	{
		category: "gameplay",
		description:
			"Minecraft combat library for Minestom, with support for both 1.9+ and 1.8 combat.",
		fullName: "TogAr2/MinestomPvP",
		name: "MinestomPvP",
		officialLinks: [
			librariesLink,
			{
				kind: "github",
				label: "TogAr2/MinestomPvP",
				url: "https://github.com/TogAr2/MinestomPvP",
			},
		],
		rationale:
			"A focused option when combat feel and PvP rules are part of the server’s core design.",
		repoUrl: "https://github.com/TogAr2/MinestomPvP",
		tags: ["combat", "pvp", "gameplay"],
		useCases: ["combat systems", "pvp rules", "attack handling"],
	},
	{
		category: "debugging",
		description: "Enables servers to render debug shapes on the client.",
		fullName: "mworzala/mc_debug_renderer",
		name: "mc_debug_renderer",
		officialLinks: [
			librariesLink,
			{
				kind: "github",
				label: "mworzala/mc_debug_renderer",
				url: "https://github.com/mworzala/mc_debug_renderer",
			},
		],
		rationale:
			"Helpful for inspecting pathing, zones, or world logic during Minestom feature development.",
		repoUrl: "https://github.com/mworzala/mc_debug_renderer",
		tags: ["debug", "visualization", "shapes", "tooling"],
		useCases: ["debug rendering", "visual debugging", "shape overlays"],
	},
];

export const featureBlueprints: Record<MinestomFeatureType, FeatureBlueprint> =
	{
		command: {
			designChecks: [
				{
					gap: "Describe where the command is registered and how it reaches `CommandManager` during bootstrap.",
					keywords: ["commandmanager", "register", "bootstrap"],
					strength: "The design accounts for explicit command registration.",
				},
				{
					gap: "Call out command syntax or argument parsing instead of relying on manual string handling.",
					keywords: ["syntax", "argument", "context"],
					strength:
						"The design acknowledges Minestom’s syntax and argument model.",
				},
				{
					gap: "Separate gameplay side effects from parsing so the command stays thin and testable.",
					keywords: ["service", "handler", "executor"],
					strength:
						"The design keeps command construction separate from gameplay effects.",
				},
			],
			fileTemplates: [
				{
					purpose: "Command builder and syntax registration entrypoint.",
					suffix: "",
				},
				{
					purpose: "Domain service invoked by the command executors.",
					suffix: "Service",
				},
			],
			implementationSteps: [
				"Define the command with explicit syntaxes and argument types before attaching gameplay effects.",
				"Keep permission checks and parsing close to the command builder, but move game-state mutations into a dedicated service.",
				"Register the command from bootstrap so the server command surface is ready before players join.",
			],
			keyApiSymbols: [
				"CommandManager",
				"Command",
				"CommandContext",
				"ArgumentType",
			],
			primaryTopic: "commands",
			summary:
				"Model the feature as a syntax-driven Minestom command with thin registration and extracted gameplay logic.",
			supportingTopics: ["bootstrap", "threading"],
			threadSafetyNotes: [
				"If the command triggers async work, reacquire player or instance state before mutating Minestom-owned objects.",
				"Avoid blocking I/O directly in command executors; schedule or hand off background work explicitly.",
			],
			verificationSteps: [
				"Register the command and confirm it appears in the server command surface.",
				"Exercise valid and invalid syntax paths, including permission or precondition failures.",
				"Verify any async branch safely hands state back to Minestom-owned threads before mutation.",
			],
		},
		"event-listener": {
			designChecks: [
				{
					gap: "State whether the listener belongs on the global handler or on a dedicated child `EventNode`.",
					keywords: ["eventnode", "globaleventhandler", "child node"],
					strength:
						"The design places the listener inside an explicit event-node structure.",
				},
				{
					gap: "Mention how the event is filtered or scoped so listener ownership stays clear.",
					keywords: ["eventfilter", "filter", "node"],
					strength: "The design accounts for listener scoping or filtering.",
				},
				{
					gap: "Move heavy world or player mutations out of the callback so the listener remains predictable.",
					keywords: ["service", "delegate", "handler"],
					strength:
						"The design keeps event callbacks thin by delegating side effects.",
				},
			],
			fileTemplates: [
				{
					purpose: "Event listener or node registration entrypoint.",
					suffix: "",
				},
				{
					purpose: "Service or coordinator used by the listener.",
					suffix: "Service",
				},
			],
			implementationSteps: [
				"Choose the right event owner boundary and create or reuse an `EventNode` for that subsystem.",
				"Filter or group listeners so they can be removed or evolved without touching unrelated gameplay systems.",
				"Delegate expensive or reusable logic to a service instead of packing it into one callback.",
			],
			keyApiSymbols: [
				"EventNode",
				"GlobalEventHandler",
				"EventFilter",
				"EventListener",
			],
			primaryTopic: "events",
			summary:
				"Build the feature as a scoped event-node listener instead of a free-floating global callback.",
			supportingTopics: ["threading"],
			threadSafetyNotes: [
				"Keep listener callbacks short and non-blocking; offload expensive work and re-enter safely afterward.",
				"Treat entity and instance mutations as ownership-sensitive if async work is involved.",
			],
			verificationSteps: [
				"Confirm the listener is attached to the intended node and receives only the targeted events.",
				"Validate both the happy path and ignored/filter-miss paths.",
				"Check that async or delayed branches do not mutate Minestom state from arbitrary threads.",
			],
		},
		"instance-setup": {
			designChecks: [
				{
					gap: "Explain whether the feature creates an `InstanceContainer`, `SharedInstance`, or reuses an existing world.",
					keywords: ["instancecontainer", "sharedinstance", "instance"],
					strength:
						"The design identifies the correct Minestom instance primitive.",
				},
				{
					gap: "State where generation or world rules live so world setup is not mixed into player assignment.",
					keywords: ["generator", "chunk", "world rules", "spawn"],
					strength:
						"The design separates world configuration from player flow.",
				},
				{
					gap: "Describe how players are assigned or transferred into the instance.",
					keywords: [
						"asyncplayerconfigurationevent",
						"spawn",
						"player",
						"setspawninginstance",
					],
					strength:
						"The design accounts for player placement and entry into the instance.",
				},
			],
			fileTemplates: [
				{
					purpose: "Instance bootstrapper or factory.",
					suffix: "",
				},
				{
					purpose: "World generator or rules helper.",
					suffix: "Generator",
				},
			],
			implementationSteps: [
				"Choose the instance type based on isolation needs and document that ownership decision.",
				"Keep world generation, chunk setup, or spawn rules in named helpers rather than in player configuration callbacks.",
				"Wire player entry into the instance through an explicit configuration or transfer flow.",
			],
			keyApiSymbols: [
				"InstanceManager",
				"Instance",
				"InstanceContainer",
				"SharedInstance",
				"Generator",
			],
			primaryTopic: "instances",
			summary:
				"Treat instance setup as a world-ownership problem with explicit generation and player-placement flows.",
			supportingTopics: ["bootstrap", "threading"],
			threadSafetyNotes: [
				"Be explicit about which code owns instance state, especially when generation or persistence touches async work.",
				"Avoid mutating world state from background tasks without reacquiring or handing work back safely.",
			],
			verificationSteps: [
				"Create the instance and confirm players can enter it through the expected configuration path.",
				"Validate chunk generation or world rules in the target area.",
				"Exercise any async loading or persistence path without cross-thread state mutations.",
			],
		},
		"scheduled-task": {
			designChecks: [
				{
					gap: "Describe how the task is registered through Minestom scheduling rather than a custom timer.",
					keywords: ["schedulermanager", "scheduler", "task"],
					strength:
						"The design is rooted in Minestom’s scheduler infrastructure.",
				},
				{
					gap: "State the timing semantics with schedules, delay, repeat, or execution type.",
					keywords: [
						"taskschedule",
						"executiontype",
						"repeat",
						"delay",
						"async",
					],
					strength:
						"The design makes scheduler timing and execution choices explicit.",
				},
				{
					gap: "Document cancellation or shutdown ownership for the task lifecycle.",
					keywords: ["cancel", "shutdown", "stop", "lifecycle"],
					strength: "The design accounts for task lifetime and teardown.",
				},
			],
			fileTemplates: [
				{
					purpose: "Task registration entrypoint or owning coordinator.",
					suffix: "",
				},
				{
					purpose: "Service that performs the repeated or delayed task body.",
					suffix: "Coordinator",
				},
			],
			implementationSteps: [
				"Create the task through Minestom’s scheduler manager and document whether it is sync or async.",
				"Keep the repeated task body small and delegate reusable logic to a coordinator or service.",
				"Pair task registration with explicit cancellation ownership at shutdown or feature disable time.",
			],
			keyApiSymbols: [
				"ServerProcess",
				"SchedulerManager",
				"Task",
				"TaskSchedule",
				"ExecutionType",
			],
			primaryTopic: "scheduler",
			summary:
				"Model scheduled features through Minestom’s scheduler with explicit timing, execution type, and cancellation.",
			supportingTopics: ["threading"],
			threadSafetyNotes: [
				"Choose sync vs async execution intentionally and document why.",
				"If async work touches players, entities, or instances, reacquire or hand work back before mutation.",
			],
			verificationSteps: [
				"Confirm the task starts on the expected trigger and runs with the intended cadence.",
				"Verify cancellation or shutdown stops the task cleanly.",
				"Exercise async branches to confirm Minestom-owned state is not mutated off-thread.",
			],
		},
		"server-bootstrap": {
			designChecks: [
				{
					gap: "Describe where `MinecraftServer.init()` and `start(...)` happen in the bootstrap lifecycle.",
					keywords: ["minecraftserver", "init", "start"],
					strength:
						"The design captures the core Minestom bootstrap lifecycle.",
				},
				{
					gap: "Call out which managers or handlers are wired during bootstrap, especially commands, events, and instances.",
					keywords: [
						"commandmanager",
						"globaleventhandler",
						"instancemanager",
						"instancecontainer",
					],
					strength:
						"The design wires the main Minestom managers during bootstrap.",
				},
				{
					gap: "Explain how first-player configuration chooses or creates a playable instance.",
					keywords: [
						"asyncplayerconfigurationevent",
						"spawn",
						"instancecontainer",
						"setspawninginstance",
					],
					strength:
						"The design accounts for player entry and instance assignment.",
				},
			],
			fileTemplates: [
				{
					purpose: "Bootstrap entrypoint that initializes and starts Minestom.",
					suffix: "",
				},
				{
					purpose: "Player configuration or join-flow listener.",
					suffix: "PlayerConfig",
				},
				{
					purpose: "World and instance wiring helper.",
					suffix: "Worlds",
				},
			],
			implementationSteps: [
				"Initialize Minestom once, then wire instances, event nodes, and commands before starting the server.",
				"Keep player configuration and instance assignment explicit so the first join path is deterministic.",
				"Centralize manager registration in bootstrap instead of scattering it across gameplay classes.",
			],
			keyApiSymbols: [
				"MinecraftServer",
				"ServerProcess",
				"InstanceManager",
				"GlobalEventHandler",
				"CommandManager",
			],
			primaryTopic: "bootstrap",
			summary:
				"Bootstrap should be a manager-wiring phase that prepares a playable Minestom server before `start(...)` is called.",
			supportingTopics: ["instances", "events", "commands"],
			threadSafetyNotes: [
				"Keep startup wiring deterministic and avoid burying background work inside the main bootstrap path.",
				"If bootstrap includes async loading, document how Minestom-owned state is re-entered before start.",
			],
			verificationSteps: [
				"Start the server and confirm the bootstrap path creates at least one playable instance.",
				"Verify commands, event listeners, and player configuration are ready before the first player joins.",
				"Exercise startup failure paths or missing configuration so bootstrap errors stay obvious.",
			],
		},
	};

export function getTopicEntry(topic: MinestomTopic): MinestomTopicEntry {
	return topicCatalog[topic];
}

export function getApisForTopic(topic: MinestomTopic): MinestomApiEntry[] {
	return apiCatalog.filter((entry) => entry.topic === topic);
}

export function getApisBySymbols(symbols: string[]): MinestomApiEntry[] {
	return symbols
		.map((symbol) => apiCatalog.find((entry) => entry.symbol === symbol))
		.filter((entry): entry is MinestomApiEntry => entry !== undefined);
}

export function getFeatureBlueprint(
	featureType: MinestomFeatureType,
): FeatureBlueprint {
	return featureBlueprints[featureType];
}
