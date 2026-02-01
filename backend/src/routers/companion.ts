import express from "express";
import { prisma } from "../prisma/client.js";
import { verifyToken, verifyPassword, isAuthEnabled } from "../auth/auth.js";
import { broadcastState } from "../services/screenState.js";
import { invalidateStateCache } from "../services/cache.js";
import { logger } from "../utils/logger.js";
import { companionRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();
router.use(companionRateLimiter);

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
            orderBy: { name: "asc" },
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
        const configuredOnly = req.query.configured === "true";

        // Get all scenarios
        const scenarios = await prisma.scenario.findMany({
            orderBy: { displayOrder: "asc" },
            select: { id: true, name: true },
        });

        // Get all assignments grouped by scenario name
        const assignments = await prisma.scenarioAssignment.findMany({
            select: { screenId: true, scenario: true },
        });

        // Create a map of scenario name -> assigned screen IDs
        const assignmentMap = new Map<string, string[]>();
        for (const a of assignments) {
            const existing = assignmentMap.get(a.scenario) || [];
            existing.push(a.screenId);
            assignmentMap.set(a.scenario, existing);
        }

        // Enrich scenarios with assignment info
        const enrichedScenarios = scenarios.map((s) => ({
            id: s.id,
            name: s.name,
            hasAssignments: assignmentMap.has(s.name),
            assignedScreenIds: assignmentMap.get(s.name) || [],
        }));

        // Filter if requested
        const result = configuredOnly
            ? enrichedScenarios.filter((s) => s.hasAssignments)
            : enrichedScenarios;

        res.json(result);
    } catch (error) {
        logger.error("Error fetching scenarios:", error);
        res.status(500).json({ error: "Failed to fetch scenarios" });
    }
});

router.get("/presets", requireCompanionAuth, async (req, res) => {
    try {
        const presets = await prisma.preset.findMany({
            orderBy: { createdAt: "asc" },
        });
        const result = presets.map((p) => ({
            id: p.id,
            name: p.name,
            scenarios: JSON.parse(p.scenarios) as Record<string, string>,
        }));
        res.json(result);
    } catch (error) {
        logger.error("Error fetching presets:", error);
        res.status(500).json({ error: "Failed to fetch presets" });
    }
});

// Create a new preset
router.post("/presets", requireCompanionAuth, async (req, res) => {
    try {
        const { name, scenarios } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            res.status(400).json({ error: "name is required" });
            return;
        }

        if (typeof scenarios !== "object" || scenarios === null) {
            res.status(400).json({ error: "scenarios object is required" });
            return;
        }

        const preset = await prisma.preset.create({
            data: {
                name: name.trim(),
                scenarios: JSON.stringify(scenarios),
            },
        });

        res.status(201).json({
            id: preset.id,
            name: preset.name,
            scenarios: scenarios as Record<string, string>,
        });
    } catch (error) {
        logger.error("Error creating preset:", error);
        res.status(500).json({ error: "Failed to create preset" });
    }
});

// Update an existing preset
router.put("/presets/:id", requireCompanionAuth, async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { name, scenarios } = req.body;

        const existing = await prisma.preset.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Preset not found" });
            return;
        }

        const data: { name?: string; scenarios?: string } = {};

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                res.status(400).json({ error: "name must be a non-empty string" });
                return;
            }
            data.name = name.trim();
        }

        if (scenarios !== undefined) {
            if (typeof scenarios !== "object" || scenarios === null) {
                res.status(400).json({ error: "scenarios must be an object" });
                return;
            }
            data.scenarios = JSON.stringify(scenarios);
        }

        const preset = await prisma.preset.update({
            where: { id },
            data,
        });

        res.json({
            id: preset.id,
            name: preset.name,
            scenarios: JSON.parse(preset.scenarios) as Record<string, string>,
        });
    } catch (error) {
        logger.error("Error updating preset:", error);
        res.status(500).json({ error: "Failed to update preset" });
    }
});

// Delete a preset
router.delete("/presets/:id", requireCompanionAuth, async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const existing = await prisma.preset.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Preset not found" });
            return;
        }

        await prisma.preset.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        logger.error("Error deleting preset:", error);
        res.status(500).json({ error: "Failed to delete preset" });
    }
});

// Get all scenario assignments with content type info
router.get("/assignments", requireCompanionAuth, async (req, res) => {
    try {
        const assignments = await prisma.scenarioAssignment.findMany({
            orderBy: [{ screenId: "asc" }, { scenario: "asc" }],
            include: {
                images: {
                    orderBy: { order: "asc" },
                    select: { imagePath: true },
                },
            },
        });

        const result = assignments.map((a) => ({
            screenId: a.screenId,
            scenario: a.scenario,
            contentType: a.intervalMs !== null && a.images.length > 1 ? "slideshow" : "still_image",
            imagePath: a.imagePath,
            intervalMs: a.intervalMs,
            images: a.images.map((img) => img.imagePath),
        }));

        res.json(result);
    } catch (error) {
        logger.error("Error fetching assignments:", error);
        res.status(500).json({ error: "Failed to fetch assignments" });
    }
});

// Get scenario assignments for a specific screen
router.get("/assignments/:screenId", requireCompanionAuth, async (req, res) => {
    try {
        const screenId = Array.isArray(req.params.screenId) ? req.params.screenId[0] : req.params.screenId;

        const screen = await prisma.screen.findUnique({ where: { id: screenId } });
        if (!screen) {
            res.status(404).json({ error: "Screen not found" });
            return;
        }

        const assignments = await prisma.scenarioAssignment.findMany({
            where: { screenId },
            orderBy: { scenario: "asc" },
            include: {
                images: {
                    orderBy: { order: "asc" },
                    select: { imagePath: true },
                },
            },
        });

        const result = assignments.map((a) => ({
            screenId: a.screenId,
            scenario: a.scenario,
            contentType: a.intervalMs !== null && a.images.length > 1 ? "slideshow" : "still_image",
            imagePath: a.imagePath,
            intervalMs: a.intervalMs,
            images: a.images.map((img) => img.imagePath),
        }));

        res.json(result);
    } catch (error) {
        logger.error("Error fetching screen assignments:", error);
        res.status(500).json({ error: "Failed to fetch screen assignments" });
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

        invalidateStateCache();
        await broadcastState();
        res.json({ success: true });
    } catch (error) {
        logger.error("Error setting screen content:", error);
        res.status(500).json({ error: "Failed to set screen content" });
    }
});

// Turn off a screen (set imageSrc to null)
router.post("/screens/:id/off", requireCompanionAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const screenId = Array.isArray(id) ? id[0] : id;

        const screen = await prisma.screen.findUnique({ where: { id: screenId } });
        if (!screen) {
            res.status(404).json({ error: "Screen not found" });
            return;
        }

        await prisma.screenState.upsert({
            where: { screenId },
            update: { imageSrc: null, scenario: null },
            create: { screenId, imageSrc: null, scenario: null },
        });

        invalidateStateCache();
        await broadcastState();
        res.json({ success: true });
    } catch (error) {
        logger.error("Error turning off screen:", error);
        res.status(500).json({ error: "Failed to turn off screen" });
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
            update: { imageSrc: assignment.imagePath, scenario: scenarioName },
            create: { screenId, imageSrc: assignment.imagePath, scenario: scenarioName },
        });

        invalidateStateCache();
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

        let scenarios: Record<string, string>;
        try {
            scenarios = JSON.parse(preset.scenarios);
        } catch {
            res.status(500).json({ error: "Invalid preset data" });
            return;
        }

        // For each screenId/scenarioName, look up the ScenarioAssignment to get imagePath
        for (const [screenId, scenarioName] of Object.entries(scenarios)) {
            const assignment = await prisma.scenarioAssignment.findUnique({
                where: {
                    screenId_scenario: {
                        screenId,
                        scenario: scenarioName,
                    },
                },
            });

            if (assignment) {
                await prisma.screenState.upsert({
                    where: { screenId },
                    update: { imageSrc: assignment.imagePath },
                    create: { screenId, imageSrc: assignment.imagePath },
                });
            }
        }

        invalidateStateCache();
        await broadcastState();
        res.json({ success: true });
    } catch (error) {
        logger.error("Error triggering preset:", error);
        res.status(500).json({ error: "Failed to trigger preset" });
    }
});

export default router;
