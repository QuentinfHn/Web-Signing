import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../prisma/client.js";
import { logger } from "../utils/logger.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { uploadRateLimiter } from "../middleware/rateLimit.js";
import { sanitizeFilename, validateFileType, validateFileExtension } from "../utils/fileUtils.js";
import { ALLOWED_MIME_TYPES } from "../config/upload.js";

const router = express.Router();
router.use(uploadRateLimiter);

const contentPath = path.join(process.cwd(), "content");

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
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
            return cb(new Error("Invalid file type"));
        }

        const isValidExt = await validateFileExtension(file.originalname);
        if (!isValidExt) {
            return cb(new Error("Invalid file extension"));
        }

        cb(null, true);
    },
});

router.post("/", requireAuth, upload.single("file"), async (req, res) => {
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

export default router;
