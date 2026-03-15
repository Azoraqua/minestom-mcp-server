import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export type StructuredContent = Record<string, unknown>;

export type TanStackServerTool = {
	description: string;
	execute?: (args: unknown) => Promise<StructuredContent> | StructuredContent;
	inputSchema?: unknown;
	metadata?: Record<string, unknown>;
	name: string;
	needsApproval?: boolean;
	outputSchema?: unknown;
};

type RegisterTool = (
	name: string,
	config: {
		annotations: ToolAnnotations;
		description: string;
		inputSchema?: unknown;
		outputSchema?: unknown;
		_meta: Record<string, unknown>;
	},
	cb: (args: unknown) => Promise<{
		content: Array<{
			text: string;
			type: "text";
		}>;
		structuredContent: StructuredContent;
	}>,
) => void;

function buildAnnotations(tool: TanStackServerTool): ToolAnnotations {
	return {
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
		readOnlyHint: !tool.needsApproval,
		title: tool.name,
	};
}

function formatContent(result: StructuredContent): string {
	return JSON.stringify(result, null, 2);
}

export function registerTanStackTool(
	server: McpServer,
	tool: TanStackServerTool,
): void {
	const registerTool = server.registerTool.bind(
		server,
	) as unknown as RegisterTool;

	registerTool(
		tool.name,
		{
			annotations: buildAnnotations(tool),
			description: tool.description,
			inputSchema: tool.inputSchema as never,
			outputSchema: tool.outputSchema as never,
			_meta: {
				needsApproval: tool.needsApproval ?? false,
				tanstackMetadata: tool.metadata ?? {},
			},
		},
		async (args: unknown) => {
			if (!tool.execute) {
				throw new Error(
					`TanStack tool "${tool.name}" is missing an execute handler.`,
				);
			}

			const structuredContent = await tool.execute(args);

			return {
				content: [
					{
						type: "text" as const,
						text: formatContent(structuredContent),
					},
				],
				structuredContent,
			};
		},
	);
}

export function registerTanStackTools(
	server: McpServer,
	tools: TanStackServerTool[],
): void {
	for (const tool of tools) {
		registerTanStackTool(server, tool);
	}
}
