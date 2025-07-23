import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { runQuery } from "./engine";
import { inputSchema } from "./input";

export function getMcpServer() {
    const server = new McpServer(
        {
            name: "tiny-dataset-query-engine-server",
            version: "1.0.0",
        },
        { capabilities: {} },
    );

    server.tool(
        "query-dataset",
        "This tool allows you to run natural language queries against an Apify dataset. For example, if you run a web scraping Actor and want to know how many pages contain a specific keyword, you can ask this Actor to find out for you.",
        {
            query: z
                .string()
                .describe(
                    "The natural language query to run against the dataset.",
                )
                .min(1),
            dataset: z
                .string()
                .describe("The ID of the dataset to query.")
                .min(1),
            modelName: z
                .string()
                .optional()
                .describe(
                    'The LLM model to use for the query. Defaults to "google/gemini-2.5-flash". Available models: google/gemini-2.5-flash, google/gemini-2.0-flash-001, openai/gpt-4.1, openai/gpt-4.1-mini.',
                ),
        },
        async ({ query, dataset, modelName }): Promise<CallToolResult> => {
            const effectiveModelName = modelName ?? "google/gemini-2.5-flash";
            const input = inputSchema.parse({
                query,
                dataset,
                modelName: effectiveModelName,
            });
            const response = await runQuery({
                query: input.query,
                dataset: input.dataset,
                modelName: input.modelName,
            });

            if (response) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Query result: ${response}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: "Invalid query or dataset.",
                    },
                ],
            };
        },
    );
    return server;
}
