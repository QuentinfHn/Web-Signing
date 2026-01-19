import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs/promises";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { createWebSocketHandler } from "./websocket/handler.js";
import { prisma } from "./prisma/client.js";
import { logger } from "./utils/logger.js";
import { initDefaultData } from "./startup/initDefaultData.js";
import { verifyToken, isAuthEnabled } from "./auth/auth.js";
import { uploadRateLimiter } from "./middleware/rateLimit.js";
import companionRouter from "./routers/companion.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
];

const ALLOWED_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".mp4",
    ".webm",
];

const FILE_MAGIC_NUMBERS = {
    "image/png": Buffer.from([0x89, 0x50, 0x4E, 0x47]),
    "image/jpeg": Buffer.from([0xFF, 0xD8, 0xFF]),
    "image/gif": Buffer.from([0x47, 0x49, 0x46]),
    "image/webp": Buffer.from([0x52, 0x49, 0x46, 0x46]),
    "video/mp4": Buffer.from([0x00, 0x00, 0x00]),
    "video/webm": Buffer.from([0x1A, 0x45, 0xDF, 0xA3]),
};

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/^\.+/, "")
        .trim();
}

async function validateFileType(filePath: string, declaredMimeType: string): Promise<boolean> {
    const fileBuffer = await fs.readFile(filePath);
    const magicNumber = FILE_MAGIC_NUMBERS[declaredMimeType as keyof typeof FILE_MAGIC_NUMBERS];

    if (!magicNumber) {
        return true;
    }

    return fileBuffer.subarray(0, magicNumber.length).equals(magicNumber);
}

async function validateFileExtension(filename: string): Promise<boolean> {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize default data (creates default display/screen if database is empty)
await initDefaultData();

// Initialize WebSocket handler
createWebSocketHandler(wss);

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

// Companion API endpoints
app.use("/api/companion", companionRouter);

// Serve static content (images)
const contentPath = path.join(__dirname, "../../content");
app.use("/content", express.static(contentPath));

const upload = multer({
    storage: multer.diskStorage({
        destination: async (req, _file, cb) => {
            const category = typeof req.body?.category === 'string' ? sanitizeFilename(req.body.category) : "shared";
            const uploadDir = path.join(contentPath, category);

            try {
                await fs.mkdir(uploadDir, { recursive: true });
                cb(null, uploadDir);
            } catch (error) {
                cb(error as Error, uploadDir);
            }
        },
        filename: async (_req, file, cb) => {
            const sanitizedOriginal = sanitizeFilename(file.originalname);
            const ext = path.extname(sanitizedOriginal).toLowerCase();
            const name = path.basename(sanitizedOriginal, ext);
            const uniqueName = `${name}-${Date.now()}${ext}`;
            cb(null, uniqueName);
        },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: async (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return cb(new Error("Invalid file type"));
        }

        const isValidExt = await validateFileExtension(file.originalname);
        if (!isValidExt) {
            return cb(new Error("Invalid file extension"));
        }

        cb(null, true);
    },
});

// Auth middleware for upload endpoint
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip auth if not enabled
    if (!isAuthEnabled()) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Authenticatie vereist" });
        return;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
        res.status(401).json({ error: "Ongeldige of verlopen sessie" });
        return;
    }

    next();
};

app.post("/api/upload", uploadRateLimiter, requireAuth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const sanitizedCategory = typeof req.body?.category === 'string' ? sanitizeFilename(req.body.category) : "shared";
        const relativePath = `/content/${sanitizedCategory}/${req.file.filename}`;

        const isValidType = await validateFileType(req.file.path, req.file.mimetype);
        if (!isValidType) {
            await fs.unlink(req.file.path);
            res.status(400).json({ error: "File content does not match declared type" });
            return;
        }

        const content = await prisma.content.create({
            data: {
                filename: req.file.originalname,
                path: relativePath,
                category: sanitizedCategory,
                mimeType: req.file.mimetype,
                size: req.file.size,
            },
        });

        res.json({ success: true, content });
    } catch (error) {
        logger.error("Upload error:", error);
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch {
                // Ignore deletion errors
            }
        }
        res.status(500).json({ error: "Upload failed" });
    }
});

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
