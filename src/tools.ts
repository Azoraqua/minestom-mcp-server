import { inspectMinestomBuildTool } from "./minestom/build.js";
import { inspectMinestomEnvironmentTool } from "./minestom/environment.js";
import {
	explainMinestomPatternTool,
	lookupMinestomApiTool,
} from "./minestom/knowledge.js";
import { suggestMinestomLibrariesTool } from "./minestom/libraries.js";
import { createGetServerInfoTool, pingTool } from "./minestom/meta.js";
import {
	planMinestomFeatureTool,
	reviewMinestomDesignTool,
} from "./minestom/planning.js";
import type { TanStackServerTool } from "./tanstack-tools.js";

const tools: TanStackServerTool[] = [];
const toolNames = () => tools.map((tool) => tool.name);

tools.push(
	pingTool,
	createGetServerInfoTool(toolNames),
	inspectMinestomEnvironmentTool,
	inspectMinestomBuildTool,
	explainMinestomPatternTool,
	lookupMinestomApiTool,
	planMinestomFeatureTool,
	reviewMinestomDesignTool,
	suggestMinestomLibrariesTool,
);

export const serverTools = tools;
