import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import { appRouter } from "./trpc/router.js";
import { createWebSocketHandler } from "./websocket/handler.js";
import { prisma } from "./prisma/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize WebSocket handler
createWebSocketHandler(wss);

// CORS for development
app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
        res.sendStatus(200);
        return;
    }
    next();
});

// tRPC endpoint
app.use(
    "/trpc",
    createExpressMiddleware({
        router: appRouter,
    })
);

// Serve static content (images)
const contentPath = path.join(__dirname, "../../content");
app.use("/content", express.static(contentPath));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const category = (req.body?.category as string) || "shared";
        const uploadDir = path.join(contentPath, category);

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        // Keep original filename, add timestamp to prevent conflicts
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const uniqueName = `${name}-${Date.now()}${ext}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (_req, file, cb) => {
        // Only allow images and videos
        const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"));
        }
    },
});

// Upload endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const category = (req.body?.category as string) || "shared";
        const relativePath = `/content/${category}/${req.file.filename}`;

        // Save to database
        const content = await prisma.content.create({
            data: {
                filename: req.file.originalname,
                path: relativePath,
                category,
                mimeType: req.file.mimetype,
                size: req.file.size,
            },
        });

        res.json({ success: true, content });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Upload failed" });
    }
});

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🔌 tRPC endpoint: http://localhost:${PORT}/trpc`);
});
