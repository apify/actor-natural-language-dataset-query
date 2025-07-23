import express from "express";
import type { Request, Response, NextFunction } from "express";
import { runQuery } from "./engine";
import { log } from "apify";
import { inputSchema } from "./input";
import { getMcpServer } from "./mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { randomUUID } from "node:crypto";
import { APIFY_API_BASE_URL, APIFY_FAVICON_URL } from "./const";

function getServerPort(): number {
    const port = process.env.ACTOR_WEB_SERVER_PORT;
    if (!port) {
        throw new Error(
            "Environment variable ACTOR_WEB_SERVER_PORT is not set",
        );
    }
    const parsedPort = Number.parseInt(port, 10);
    if (Number.isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
        throw new Error(`Invalid port number: ${port}`);
    }
    return parsedPort;
}

function getQueryParamStringValue(req: Request, param: string): string | null {
    const value = req.query[param];
    if (typeof value === "string" && value.trim() !== "") {
        return value.trim();
    }
    return null;
}

export function runStandby() {
    // Store transports by session ID
    const transports: Record<
        string,
        StreamableHTTPServerTransport | SSEServerTransport
    > = {};

    const app = express();

    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.headers["x-apify-container-server-readiness-probe"]) {
            res.status(200).type("text/plain").send("ok");
        } else {
            next();
        }
    });
    app.use(express.json());

    app.get("/", async (req: Request, res: Response) => {
        const query = getQueryParamStringValue(req, "query");
        const dataset = getQueryParamStringValue(req, "dataset");
        const modelName =
            getQueryParamStringValue(req, "modelName") ||
            "google/gemini-2.5-flash";
        const input = inputSchema.safeParse({
            query,
            dataset,
            modelName,
        });
        if (!input.success) {
            res.status(400).json({
                error: "Invalid input",
                details: input.error,
            });
            return;
        }

        const response = await runQuery({
            query: input.data.query,
            dataset: input.data.dataset,
            modelName: input.data.modelName,
        });

        res.status(200).json({ response });
    });

    app.get("/favicon.ico", (_req: Request, res: Response) => {
        res.writeHead(301, { Location: APIFY_FAVICON_URL });
        res.end();
    });

    app.get(
        "/.well-known/oauth-authorization-server",
        async (_req: Request, res: Response) => {
            // Some MCP clients do not follow redirects, so we need to fetch the data and return it directly.
            const response = await fetch(
                `${APIFY_API_BASE_URL}/.well-known/oauth-authorization-server`,
            );
            const data = await response.json();
            res.status(200).json(data);
        },
    );

    //=============================================================================
    // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
    //=============================================================================

    // Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
    app.all("/mcp", async (req: Request, res: Response) => {
        log.info(`Received ${req.method} request to /mcp`);

        try {
            // Check for existing session ID
            const sessionId = req.headers["mcp-session-id"] as
                | string
                | undefined;
            let transport: StreamableHTTPServerTransport;

            if (sessionId && transports[sessionId]) {
                // Check if the transport is of the correct type
                const existingTransport = transports[sessionId];
                if (
                    existingTransport instanceof StreamableHTTPServerTransport
                ) {
                    // Reuse existing transport
                    transport = existingTransport;
                } else {
                    // Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)
                    res.status(400).json({
                        jsonrpc: "2.0",
                        error: {
                            code: -32000,
                            message:
                                "Bad Request: Session exists but uses a different transport protocol",
                        },
                        id: null,
                    });
                    return;
                }
            } else if (
                !sessionId &&
                req.method === "POST" &&
                isInitializeRequest(req.body)
            ) {
                const eventStore = new InMemoryEventStore();
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    eventStore, // Enable resumability
                    onsessioninitialized: (sessionId) => {
                        // Store the transport by session ID when session is initialized
                        log.info(
                            `StreamableHTTP session initialized with ID: ${sessionId}`,
                        );
                        transports[sessionId] = transport;
                    },
                });

                // Set up onclose handler to clean up transport when closed
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && transports[sid]) {
                        log.info(
                            `Transport closed for session ${sid}, removing from transports map`,
                        );
                        delete transports[sid];
                    }
                };

                // Connect the transport to the MCP server
                const server = getMcpServer();
                await server.connect(transport);
            } else {
                // Invalid request - no session ID or not initialization request
                res.status(400).json({
                    jsonrpc: "2.0",
                    error: {
                        code: -32000,
                        message: "Bad Request: No valid session ID provided",
                    },
                    id: null,
                });
                return;
            }

            // Handle the request with the transport
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            log.error("Error handling MCP request:", { error });
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: "Internal server error",
                    },
                    id: null,
                });
            }
        }
    });

    //=============================================================================
    // DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
    //=============================================================================

    app.get("/sse", async (_req: Request, res: Response) => {
        log.info("Received GET request to /sse (deprecated SSE transport)");
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        res.on("close", () => {
            delete transports[transport.sessionId];
        });
        const server = getMcpServer();
        await server.connect(transport);
    });

    app.post("/messages", async (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string;
        let transport: SSEServerTransport;
        const existingTransport = transports[sessionId];
        if (existingTransport instanceof SSEServerTransport) {
            // Reuse existing transport
            transport = existingTransport;
        } else {
            // Transport exists but is not a SSEServerTransport (could be StreamableHTTPServerTransport)
            res.status(400).json({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message:
                        "Bad Request: Session exists but uses a different transport protocol",
                },
                id: null,
            });
            return;
        }
        if (transport) {
            await transport.handlePostMessage(req, res, req.body);
        } else {
            res.status(400).send("No transport found for sessionId");
        }
    });

    const port = getServerPort();
    app.listen(port, () => {
        log.info(`Standby server is running on port ${port}`);
    });
}
