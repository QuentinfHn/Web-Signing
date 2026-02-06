import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import fs from "fs";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { createWebSocketHandler } from "./websocket/handler.js";
import { prisma } from "./prisma/client.js";
import { logger } from "./utils/logger.js";
import { initDefaultData } from "./startup/initDefaultData.js";
import companionRouter from "./routers/companion.js";
import uploadRouter from "./routers/uploadRouter.js";
import { contentPath } from "./config/paths.js";
import { startVnnoxPoller, setStatusChangeCallback } from "./services/vnnoxPoller.js";
import { broadcastVnnoxStatus } from "./services/screenState.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize default data (creates default display/screen if database is empty)
await initDefaultData();

// Initialize WebSocket handler
createWebSocketHandler(wss);

// Start VNNOX poller (if configured)
setStatusChangeCallback(broadcastVnnoxStatus);
startVnnoxPoller();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000").split(",").map(o => o.trim());
const ALLOWED_METHODS = ["GET", "POST", "OPTIONS", "PUT", "DELETE"];
const ALLOWED_HEADERS = ["Content-Type", "Authorization", "x-api-key"];

function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return false;
    if (ALLOWED_ORIGINS.includes("*")) return true;
    return ALLOWED_ORIGINS.includes(origin);
}

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && isOriginAllowed(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));

    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }

    next();
});

// tRPC endpoint with context
app.use(
    "/trpc",
    createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) => createContext({ req }),
    })
);

// JSON body parser (required for companion POST endpoints)
app.use(express.json());

// Companion API endpoints
app.use("/api/companion", companionRouter);

// Serve static content (images)

// Ensure content directory exists on startup
if (!fs.existsSync(contentPath)) {
    logger.info(`Content directory not found at ${contentPath}, creating it...`);
    try {
        fs.mkdirSync(contentPath, { recursive: true });
    } catch (error) {
        logger.error(`Failed to create content directory: ${error}`);
    }
}

app.use("/content", express.static(contentPath));

// Upload API endpoints
app.use("/api/upload", uploadRouter);

// Health check
app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error("Health check failed:", error);
        res.status(503).json({
            status: "unhealthy",
            database: "disconnected",
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`WebSocket server ready`);
    logger.info(`tRPC endpoint: http://localhost:${PORT}/trpc`);
});
