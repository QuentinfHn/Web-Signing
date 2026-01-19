import express from "express";
import { prisma } from "../prisma/client.js";
import { verifyToken, verifyPassword, isAuthEnabled } from "../auth/auth.js";
import { broadcastState } from "../services/screenState.js";
import { logger } from "../utils/logger.js";
import { apiRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();
router.use(apiRateLimiter);

function requireCompanionAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!isAuthEnabled()) {
        next();
        return;
    }

    const apiKey = Array.isArray(req.headers["x-api-key"]) ? req.headers["x-api-key"][0] : req.headers["x-api-key"];
    const authHeader = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;

    if (apiKey) {
        if (verifyPassword(apiKey)) {
            next();
            return;
        }
    }

    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const payload = verifyToken(token);
        if (payload) {
            next();
            return;
        }
    }

    res.status(401).json({ error: "Unauthorized" });
}

router.get("/displays", requireCompanionAuth, async (req, res) => {
    try {
        const displays = await prisma.display.findMany({
            orderBy: { id: "asc" },
            include: { _count: { select: { screens: true } } },
        });
        res.json(displays);
    } catch (error) {
        logger.error("Error fetching displays:", error);
        res.status(500).json({ error: "Failed to fetch displays" });
    }
});

router.get("/screens", requireCompanionAuth, async (req, res) => {
    try {
        const screens = await prisma.screen.findMany({
            orderBy: { id: "asc" },
            select: { id: true, name: true, displayId: true },
        });
        res.json(screens);
    } catch (error) {
        logger.error("Error fetching screens:", error);
        res.status(500).json({ error: "Failed to fetch screens" });
    }
});

router.get("/scenarios", requireCompanionAuth, async (req, res) => {
    try {
        const scenarios = await prisma.scenario.findMany({
            orderBy: { displayOrder: "asc" },
            select: { id: true, name: true },
        });
        res.json(scenarios);
    } catch (error) {
        logger.error("Error fetching scenarios:", error);
        res.status(500).json({ error: "Failed to fetch scenarios" });
    }
});

router.get("/presets", requireCompanionAuth, async (req, res) => {
    try {
        const presets = await prisma.preset.findMany({
            select: { id: true, name: true },
        });
        res.json(presets);
    } catch (error) {
        logger.error("Error fetching presets:", error);
        res.status(500).json({ error: "Failed to fetch presets" });
    }
});

router.post("/screens/:id/content", requireCompanionAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { imageSrc } = req.body;

        if (typeof imageSrc !== "string") {
            res.status(400).json({ error: "imageSrc is required" });
            return;
        }

        const screenId = Array.isArray(id) ? id[0] : id;
        const screen = await prisma.screen.findUnique({ where: { id: screenId } });
        if (!screen) {
            res.status(404).json({ error: "Screen not found" });
            return;
        }

        await prisma.screenState.upsert({
            where: { screenId },
            update: { imageSrc },
            create: { screenId, imageSrc },
        });

        await broadcastState();
        res.json({ success: true });
    } catch (error) {
        logger.error("Error setting screen content:", error);
        res.status(500).json({ error: "Failed to set screen content" });
    }
});

router.post("/scenarios/trigger", requireCompanionAuth, async (req, res) => {
    try {
        const { screenId, scenarioName } = req.body;

        if (typeof screenId !== "string" || typeof scenarioName !== "string") {
            res.status(400).json({ error: "screenId and scenarioName are required" });
            return;
        }

        const assignment = await prisma.scenarioAssignment.findUnique({
            where: {
                screenId_scenario: {
                    screenId,
                    scenario: scenarioName,
                },
            },
        });

        if (!assignment) {
            res.status(404).json({ error: "Scenario assignment not found for this screen" });
            return;
        }

        await prisma.screenState.upsert({
            where: { screenId },
            update: { imageSrc: assignment.imagePath },
            create: { screenId, imageSrc: assignment.imagePath },
        });

        await broadcastState();
        res.json({ success: true });
    } catch (error) {
        logger.error("Error triggering scenario:", error);
        res.status(500).json({ error: "Failed to trigger scenario" });
    }
});

router.post("/presets/trigger", requireCompanionAuth, async (req, res) => {
    try {
        const { presetId } = req.body;

        if (typeof presetId !== "string") {
            res.status(400).json({ error: "presetId is required" });
            return;
        }

        const preset = await prisma.preset.findUnique({
            where: { id: presetId },
        });

        if (!preset) {
            res.status(404).json({ error: "Preset not found" });
            return;
        }

        let screens: Record<string, string>;
        try {
            screens = JSON.parse(preset.screens);
        } catch {
            res.status(500).json({ error: "Invalid preset data" });
            return;
        }

        for (const [screenId, imageSrc] of Object.entries(screens)) {
            await prisma.screenState.upsert({
                where: { screenId },
                update: { imageSrc },
                create: { screenId, imageSrc },
            });
        }

        await broadcastState();
        res.json({ success: true });
    } catch (error) {
        logger.error("Error triggering preset:", error);
        res.status(500).json({ error: "Failed to trigger preset" });
    }
});

export default router;
