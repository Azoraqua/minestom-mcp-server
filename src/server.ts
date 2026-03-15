import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import { registerTanStackTools } from "./tanstack-tools.js";
import { serverTools } from "./tools.js";

(async () => {
	console.error("Starting MineStom MCP server...");
	const server = new McpServer({
		name: "minestom-mcp",
		description: packageJson.description,
		version: packageJson.version,
	});

	registerTanStackTools(server, serverTools);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(
		`MineStom server started with ${serverTools.length} tools, running through stdio.`,
	);

	process.on("uncaughtException", (err) => console.error(err));
	process.on("exit", () => console.error("Shutting down MineStom MCP server."));
	process.on("beforeExit", () => server.close());
	process.on("SIGINT", () => process.exit());
	process.on("SIGTERM", () => process.exit());
})();
