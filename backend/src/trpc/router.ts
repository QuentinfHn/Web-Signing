import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { verifyPassword, generateToken, isAuthEnabled } from "../auth/auth.js";
import type { Context } from "./context.js";
import { invalidateDisplaysCache, invalidateScreensCache, invalidateStateCache, invalidateScenarioCache } from "../services/cache.js";
import { getScreenStateMap } from "../services/screenState.js";
import { isVnnoxEnabled, fetchPlayerList } from "../services/vnnox.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

const checkLoginRateLimit = (ip: string) => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 5;

    const attempts = loginAttempts.get(ip);

    if (!attempts || now > attempts.resetTime) {
        loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (attempts.count >= maxAttempts) {
        const remainingTime = Math.ceil((attempts.resetTime - now) / 60000);
        throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Te veel login pogingen. Probeer opnieuw over ${remainingTime} minuten.`,
        });
    }

    attempts.count++;
    return true;
};

// Protected procedure - requires authentication when ADMIN_PASSWORD is set
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
    if (ctx.authRequired && !ctx.isAuthenticated) {
        throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authenticatie vereist",
        });
    }
    return next();
});

// Auth router
export const authRouter = router({
    login: publicProcedure
        .input(z.object({ password: z.string() }))
        .mutation(({ input, ctx }) => {
            checkLoginRateLimit(ctx.ip || "unknown");

            if (!isAuthEnabled()) {
                return { success: true, token: null };
            }

            if (!verifyPassword(input.password)) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Onjuist wachtwoord",
                });
            }

            const token = generateToken();
            return { success: true, token };
        }),

    verify: publicProcedure.query(({ ctx }) => {
        return {
            authenticated: ctx.isAuthenticated,
            authRequired: ctx.authRequired,
        };
    }),

    status: publicProcedure.query(() => {
        return {
            authEnabled: isAuthEnabled(),
        };
    }),
});

// Display router
export const displayRouter = router({
    list: publicProcedure.query(async () => {
        return prisma.display.findMany({
            orderBy: { id: "asc" },
            include: { _count: { select: { screens: true } } },
        });
    }),

    create: protectedProcedure
        .input(z.object({
            id: z.string().optional(),
            name: z.string().min(1),
        }))
        .mutation(async ({ input }) => {
            // Generate slug from name if no ID provided
            let id = input.id?.trim();
            if (!id) {
                // Convert name to URL-friendly slug
                const baseSlug = input.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");

                // Check for duplicates and add suffix if needed
                let slug = baseSlug;
                let counter = 1;
                while (await prisma.display.findUnique({ where: { id: slug } })) {
                    slug = `${baseSlug}-${counter}`;
                    counter++;
                }
                id = slug;
            }
            const display = await prisma.display.create({
                data: { id, name: input.name },
            });
            invalidateDisplaysCache();
            return display;
        }),

    update: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            const display = await prisma.display.update({
                where: { id },
                data,
            });
            invalidateDisplaysCache();
            return display;
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            // Check if display has screens
            const screenCount = await prisma.screen.count({
                where: { displayId: input.id },
            });
            if (screenCount > 0) {
                throw new Error(`Kan display niet verwijderen: ${screenCount} scherm(en) gekoppeld`);
            }
            await prisma.display.delete({ where: { id: input.id } });
            invalidateDisplaysCache();
            invalidateScreensCache(input.id);
            return { success: true };
        }),

    // Initialize displays from existing screens (one-time migration helper)
    initFromScreens: protectedProcedure.mutation(async () => {
        const screens = await prisma.screen.findMany({
            select: { displayId: true },
            distinct: ["displayId"],
        });

        let created = 0;
        for (const screen of screens) {
            const exists = await prisma.display.findUnique({
                where: { id: screen.displayId },
            });
            if (!exists) {
                await prisma.display.create({
                    data: { id: screen.displayId, name: screen.displayId },
                });
                created++;
            }
        }
        return { created };
    }),
});

// Screen router
export const screenRouter = router({
    list: publicProcedure.query(async () => {
        return prisma.screen.findMany({
            orderBy: { id: "asc" },
        });
    }),

    getByDisplay: publicProcedure
        .input(z.object({ displayId: z.string() }))
        .query(async ({ input }) => {
            return prisma.screen.findMany({
                where: { displayId: input.displayId },
                orderBy: { id: "asc" },
            });
        }),

    update: protectedProcedure
        .input(z.object({
            id: z.string(),
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            name: z.string().optional().nullable(),
            displayId: z.string().optional(),
            lat: z.number().optional().nullable(),
            lng: z.number().optional().nullable(),
            address: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            const existing = await prisma.screen.findUnique({
                where: { id },
                select: { displayId: true },
            });
            const screen = await prisma.screen.update({
                where: { id },
                data,
            });
            if (existing?.displayId && existing.displayId !== screen.displayId) {
                invalidateScreensCache(existing.displayId);
            }
            invalidateScreensCache(screen.displayId);
            return screen;
        }),

    create: protectedProcedure
        .input(z.object({
            displayId: z.string(),
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
            name: z.string().optional(),
            lat: z.number().optional(),
            lng: z.number().optional(),
            address: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            // Generate a readable ID: {displayId}-{name-slug} or {displayId}-screen-{n}
            const baseName = input.name?.trim() || "screen";
            const nameSlug = baseName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");

            const baseId = `${input.displayId}-${nameSlug}`;

            // Ensure uniqueness by checking for existing IDs and adding suffix if needed
            let id = baseId;
            let counter = 1;
            while (await prisma.screen.findUnique({ where: { id } })) {
                id = `${baseId}-${counter}`;
                counter++;
            }

            const screen = await prisma.screen.create({ data: { id, ...input } });
            invalidateScreensCache(input.displayId);
            return screen;
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const screen = await prisma.screen.findUnique({ where: { id: input.id } });
            await prisma.screen.delete({ where: { id: input.id } });
            if (screen) {
                invalidateScreensCache(screen.displayId);
                invalidateStateCache(screen.id);
            }
            return { success: true };
        }),

    exportAll: publicProcedure.query(async () => {
        const screens = await prisma.screen.findMany({
            orderBy: { id: "asc" },
        });
        return {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            screens: screens.map((s: { id: string; displayId: string; name: string | null; x: number; y: number; width: number; height: number; lat: number | null; lng: number | null; address: string | null }) => ({
                id: s.id,
                displayId: s.displayId,
                name: s.name,
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height,
                lat: s.lat,
                lng: s.lng,
                address: s.address,
            })),
        };
    }),

    importScreens: protectedProcedure
        .input(z.object({
            screens: z.array(z.object({
                id: z.string(),
                displayId: z.string(),
                name: z.string().nullable().optional(),
                x: z.number(),
                y: z.number(),
                width: z.number(),
                height: z.number(),
                lat: z.number().nullable().optional(),
                lng: z.number().nullable().optional(),
                address: z.string().nullable().optional(),
            })),
            conflictMode: z.enum(["update", "skip", "error"]).default("update"),
        }))
        .mutation(async ({ input }) => {
            const results: {
                created: number;
                updated: number;
                skipped: number;
                errors: string[];
            } = {
                created: 0,
                updated: 0,
                skipped: 0,
                errors: [],
            };

            for (const screen of input.screens) {
                try {
                    const existing = await prisma.screen.findUnique({
                        where: { id: screen.id },
                    });

                    if (existing) {
                        if (input.conflictMode === "error") {
                            results.errors.push(`Screen '${screen.id}' bestaat al`);
                            continue;
                        }
                        if (input.conflictMode === "skip") {
                            results.skipped++;
                            continue;
                        }
                        // update mode
                        await prisma.screen.update({
                            where: { id: screen.id },
                            data: {
                                displayId: screen.displayId,
                                name: screen.name ?? null,
                                x: screen.x,
                                y: screen.y,
                                width: screen.width,
                                height: screen.height,
                                lat: screen.lat ?? null,
                                lng: screen.lng ?? null,
                                address: screen.address ?? null,
                            },
                        });
                        results.updated++;
                    } else {
                        await prisma.screen.create({
                            data: {
                                id: screen.id,
                                displayId: screen.displayId,
                                name: screen.name ?? null,
                                x: screen.x,
                                y: screen.y,
                                width: screen.width,
                                height: screen.height,
                                lat: screen.lat ?? null,
                                lng: screen.lng ?? null,
                                address: screen.address ?? null,
                            },
                        });
                        results.created++;
                    }
                } catch (err) {
                    results.errors.push(`Fout bij screen '${screen.id}': ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            return results;
        }),
});

// Preset router
export const presetRouter = router({
    list: publicProcedure.query(async () => {
        const presets = await prisma.preset.findMany({
            orderBy: { createdAt: "asc" },
        });
        return presets.map((p: { id: string; name: string; scenarios: string; createdAt: Date; updatedAt: Date }) => ({
            ...p,
            scenarios: z.record(z.string(), z.string()).parse(JSON.parse(p.scenarios)),
        }));
    }),

    create: protectedProcedure
        .input(z.object({
            name: z.string().min(1),
            scenarios: z.record(z.string(), z.string()),
        }))
        .mutation(async ({ input }) => {
            const preset = await prisma.preset.create({
                data: {
                    name: input.name,
                    scenarios: JSON.stringify(input.scenarios),
                },
            });
            return {
                ...preset,
                scenarios: input.scenarios,
            };
        }),

    update: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().min(1).optional(),
            scenarios: z.record(z.string(), z.string()).optional(),
        }))
        .mutation(async ({ input }) => {
            const { id, name, scenarios } = input;
            const data: { name?: string; scenarios?: string } = {};

            if (name !== undefined) {
                data.name = name;
            }
            if (scenarios !== undefined) {
                data.scenarios = JSON.stringify(scenarios);
            }

            const preset = await prisma.preset.update({
                where: { id },
                data,
            });
            return {
                ...preset,
                scenarios: z.record(z.string(), z.string()).parse(JSON.parse(preset.scenarios)),
            };
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.preset.delete({ where: { id: input.id } });
            return { success: true };
        }),

    activate: protectedProcedure
        .input(z.object({ presetId: z.string() }))
        .mutation(async ({ input }) => {
            const preset = await prisma.preset.findUnique({
                where: { id: input.presetId },
            });
            if (!preset) throw new Error("Preset not found");

            const scenarios = z.record(z.string(), z.string()).parse(JSON.parse(preset.scenarios));

            // For each screenId/scenarioName, look up the ScenarioAssignment to get imagePath
            const updates: { screenId: string; imageSrc: string; scenario: string }[] = [];

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
                    updates.push({ screenId, imageSrc: assignment.imagePath, scenario: scenarioName });
                }
            }

            // Update all screen states
            for (const { screenId, imageSrc, scenario } of updates) {
                await prisma.screenState.upsert({
                    where: { screenId },
                    update: { imageSrc, scenario },
                    create: { screenId, imageSrc, scenario },
                });
                invalidateStateCache(screenId);
            }

            // Broadcast state changes via WebSocket
            const { broadcastState } = await import("../services/screenState.js");
            await broadcastState();

            return { success: true, activated: updates.length };
        }),
});

// State router
export const stateRouter = router({
    getAll: publicProcedure.query(async () => {
        return await getScreenStateMap();
    }),

    set: protectedProcedure
        .input(z.object({ screenId: z.string(), imageSrc: z.string() }))
        .mutation(async ({ input }) => {
            const state = await prisma.screenState.upsert({
                where: { screenId: input.screenId },
                update: { imageSrc: input.imageSrc },
                create: { screenId: input.screenId, imageSrc: input.imageSrc },
            });
            invalidateStateCache(input.screenId);
            return state;
        }),
});

// Content router
export const contentRouter = router({
    list: publicProcedure
        .input(z.object({ category: z.string().optional() }).optional())
        .query(async ({ input }) => {
            const where = input?.category ? { category: input.category } : {};
            const contents = await prisma.content.findMany({
                where,
                orderBy: { createdAt: "desc" },
            });

            return contents;
        }),

    getByCategory: publicProcedure
        .input(z.object({ category: z.string() }))
        .query(async ({ input }) => {
            return prisma.content.findMany({
                where: { category: input.category },
                orderBy: { createdAt: "desc" },
            });
        }),

    getCategories: publicProcedure.query(async () => {
        const contents = await prisma.content.findMany({
            select: { category: true },
            distinct: ["category"],
        });
        const categories = contents.map((c: { category: string }) => c.category);
        // Return default category if no categories exist (clean install)
        if (categories.length === 0) {
            return ["Algemeen"];
        }
        // Ensure "Algemeen" is always available as a fallback category
        if (!categories.includes("Algemeen")) {
            return ["Algemeen", ...categories];
        }
        return categories;
    }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const content = await prisma.content.findUnique({
                where: { id: input.id },
            });
            if (!content) throw new Error("Content not found");

            // Delete file from disk
            const fs = await import("fs/promises");
            const path = await import("path");
            // Path in DB is like "/content/..." - resolve to root content folder
            const filePath = path.join(process.cwd(), "..", content.path);
            try {
                await fs.unlink(filePath);
            } catch {
                // File might not exist, continue with DB deletion
            }

            // Remove references in ScreenState
            const stateUpdate = await prisma.screenState.updateMany({
                where: { imageSrc: content.path },
                data: { imageSrc: null },
            });
            let stateChanged = stateUpdate.count > 0;

            // Remove references in ScenarioAssignment and handle slideshows
            const assignments = await prisma.scenarioAssignment.findMany({
                where: { imagePath: content.path },
            });

            // Also find slideshow images not in main imagePath
            const slideshowImages = await prisma.slideshowImage.findMany({
                where: { imagePath: content.path },
            });

            // Get unique assignment IDs from both sources
            const assignmentIds = new Set([
                ...assignments.map(a => a.id),
                ...slideshowImages.map(img => img.assignmentId),
            ]);

            for (const assignmentId of assignmentIds) {
                const assignment = await prisma.scenarioAssignment.findUnique({
                    where: { id: assignmentId },
                });
                if (!assignment) continue;

                // Delete slideshow images that reference this content
                await prisma.slideshowImage.deleteMany({
                    where: { assignmentId, imagePath: content.path },
                });

                // Check remaining slideshow images
                const remainingImages = await prisma.slideshowImage.findMany({
                    where: { assignmentId },
                    orderBy: { order: "asc" },
                });

                if (remainingImages.length === 0) {
                    // Slideshow is now empty, reset to normal (empty) scenario
                    await prisma.scenarioAssignment.update({
                        where: { id: assignmentId },
                        data: {
                            imagePath: "",
                            intervalMs: null,
                        },
                    });
                    const clearedState = await prisma.screenState.updateMany({
                        where: { screenId: assignment.screenId, scenario: assignment.scenario },
                        data: { imageSrc: null, scenario: null },
                    });
                    if (clearedState.count > 0) {
                        stateChanged = true;
                    }
                } else {
                    // Update main image to the first remaining image
                    await prisma.scenarioAssignment.update({
                        where: { id: assignmentId },
                        data: {
                            imagePath: remainingImages[0].imagePath,
                        },
                    });
                }

                invalidateScenarioCache(assignment.screenId, assignment.scenario);
            }

            await prisma.content.delete({ where: { id: input.id } });
            if (stateChanged) {
                invalidateStateCache();
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }
            return { success: true };
        }),

    toggleFavorite: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const content = await prisma.content.findUnique({
                where: { id: input.id },
            });
            if (!content) throw new Error("Content not found");

            return prisma.content.update({
                where: { id: input.id },
                data: { isFavorite: !content.isFavorite },
            });
        }),

    getFavorites: publicProcedure.query(async () => {
        return prisma.content.findMany({
            where: { isFavorite: true },
            orderBy: { filename: "asc" },
        });
    }),

    rename: protectedProcedure
        .input(z.object({ id: z.string(), newFilename: z.string().min(1) }))
        .mutation(async ({ input }) => {
            const content = await prisma.content.findUnique({
                where: { id: input.id },
            });
            if (!content) throw new Error("Content not found");

            const fs = await import("fs/promises");
            const path = await import("path");

            // Path in DB is like "/content/..." - resolve to root content folder
            const oldFilePath = path.join(process.cwd(), "..", content.path);
            const dir = path.dirname(oldFilePath);
            const oldDiskFilename = path.basename(content.path);
            const ext = path.extname(oldDiskFilename);

            // Ensure new filename has the same extension
            let newFilename = input.newFilename;
            if (!newFilename.toLowerCase().endsWith(ext.toLowerCase())) {
                newFilename += ext;
            }

            const newFilePath = path.join(dir, newFilename);
            // Replace the old disk filename with the new filename in the path
            const newPath = content.path.replace(oldDiskFilename, newFilename);

            // Check if target file already exists
            try {
                await fs.access(newFilePath);
                // File exists on disk - check if it has a database record
                const existingDbRecord = await prisma.content.findFirst({
                    where: { path: newPath },
                });
                if (existingDbRecord) {
                    // File exists and has a DB record - cannot overwrite
                    throw new Error("Een bestand met deze naam bestaat al");
                }
                // File exists but no DB record - it's an orphan, delete it
                await fs.unlink(newFilePath);
            } catch (err) {
                const error = err as Error & { code?: string };
                if (error.code !== "ENOENT") {
                    throw err;
                }
            }

            // Rename file on disk
            await fs.rename(oldFilePath, newFilePath);

            // Update database
            return prisma.content.update({
                where: { id: input.id },
                data: { filename: newFilename, path: newPath },
            });
        }),

    // Cleanup orphaned content records (files that no longer exist)
    cleanup: protectedProcedure.mutation(async () => {
        const contents = await prisma.content.findMany();
        const fs = await import("fs/promises");
        const path = await import("path");

        let deleted = 0;
        for (const content of contents) {
            // Path in DB is like "/content/..." - resolve to root content folder
            const filePath = path.join(process.cwd(), "..", content.path);
            try {
                await fs.access(filePath);
            } catch {
                await prisma.content.delete({ where: { id: content.id } });
                deleted++;
            }
        }

        return { deleted };
    }),

    // Scan content folder for new files not in database
    scan: protectedProcedure.mutation(async () => {
        const fs = await import("fs/promises");
        const path = await import("path");
        const contentDir = path.join(process.cwd(), "..", "content");

        // MIME type mapping
        const mimeTypes: Record<string, string> = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mov": "video/quicktime",
        };

        let added = 0;

        try {
            // Scan all category folders
            const entries = await fs.readdir(contentDir, { withFileTypes: true });
            const categories = entries.filter(d => d.isDirectory());

            for (const cat of categories) {
                const catPath = path.join(contentDir, cat.name);
                const files = await fs.readdir(catPath);

                for (const filename of files) {
                    // Skip hidden files
                    if (filename.startsWith(".")) continue;

                    const relativePath = `/content/${cat.name}/${filename}`;

                    // Check if already in database
                    const exists = await prisma.content.findFirst({ where: { path: relativePath } });
                    if (exists) continue;

                    // Get file info
                    const filePath = path.join(catPath, filename);
                    const stat = await fs.stat(filePath);

                    // Skip directories
                    if (stat.isDirectory()) continue;

                    const ext = path.extname(filename).toLowerCase();
                    const mimeType = mimeTypes[ext];

                    // Skip unknown file types
                    if (!mimeType) continue;

                    // Add to database
                    await prisma.content.create({
                        data: {
                            filename,
                            path: relativePath,
                            category: cat.name,
                            mimeType,
                            size: stat.size,
                        },
                    });
                    added++;
                }
            }
        } catch (error) {
            // Content directory might not exist yet
            console.error("Error scanning content folder:", error);
        }

        return { added };
    }),
});

// Scenarios router - manage scenario-content assignments
export const scenariosRouter = router({
    list: publicProcedure
        .input(z.object({ screenId: z.string().optional() }).optional())
        .query(async ({ input }) => {
            const where = input?.screenId ? { screenId: input.screenId } : {};
            return prisma.scenarioAssignment.findMany({
                where,
                orderBy: [{ screenId: "asc" }, { scenario: "asc" }],
                include: { images: { orderBy: { order: "asc" } } },
            });
        }),

    getByScreen: publicProcedure
        .input(z.object({ screenId: z.string() }))
        .query(async ({ input }) => {
            const assignments = await prisma.scenarioAssignment.findMany({
                where: { screenId: input.screenId },
            });
            // Return as a map: { scenario: imagePath }
            return Object.fromEntries(
                assignments.map((a: { scenario: string; imagePath: string }) => [a.scenario, a.imagePath])
            );
        }),

    set: protectedProcedure
        .input(z.object({
            screenId: z.string(),
            scenario: z.string(),
            imagePath: z.string(),
        }))
        .mutation(async ({ input }) => {
            const assignment = await prisma.scenarioAssignment.upsert({
                where: {
                    screenId_scenario: {
                        screenId: input.screenId,
                        scenario: input.scenario,
                    },
                },
                update: { imagePath: input.imagePath },
                create: {
                    screenId: input.screenId,
                    scenario: input.scenario,
                    imagePath: input.imagePath,
                },
            });
            invalidateScenarioCache(input.screenId, input.scenario);

            const activeState = await prisma.screenState.findUnique({
                where: { screenId: input.screenId },
            });
            if (activeState?.scenario === input.scenario) {
                await prisma.screenState.update({
                    where: { screenId: input.screenId },
                    data: { imageSrc: input.imagePath, scenario: input.scenario },
                });
                invalidateStateCache(input.screenId);
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }
            return assignment;
        }),

    delete: protectedProcedure
        .input(z.object({ screenId: z.string(), scenario: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.scenarioAssignment.delete({
                where: {
                    screenId_scenario: {
                        screenId: input.screenId,
                        scenario: input.scenario,
                    },
                },
            });
            invalidateScenarioCache(input.screenId, input.scenario);
            const activeState = await prisma.screenState.findUnique({
                where: { screenId: input.screenId },
            });
            if (activeState?.scenario === input.scenario) {
                await prisma.screenState.update({
                    where: { screenId: input.screenId },
                    data: { imageSrc: null, scenario: null },
                });
                invalidateStateCache(input.screenId);
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }
            return { success: true };
        }),

    // Get all assignments grouped by screen for Control page
    getAll: publicProcedure.query(async () => {
        const assignments = await prisma.scenarioAssignment.findMany({
            include: { images: { orderBy: { order: "asc" } } },
        });
        const grouped: Record<string, Record<string, { imagePath: string; intervalMs: number | null; images: string[] }>> = {};

        for (const a of assignments) {
            if (!grouped[a.screenId]) {
                grouped[a.screenId] = {};
            }
            grouped[a.screenId][a.scenario] = {
                imagePath: a.imagePath,
                intervalMs: a.intervalMs,
                images: a.images.map((img: { imagePath: string }) => img.imagePath),
            };
        }

        return grouped;
    }),

    // Get slideshow configuration for a specific assignment
    getSlideshow: publicProcedure
        .input(z.object({ screenId: z.string(), scenario: z.string() }))
        .query(async ({ input }) => {
            const assignment = await prisma.scenarioAssignment.findUnique({
                where: {
                    screenId_scenario: {
                        screenId: input.screenId,
                        scenario: input.scenario,
                    },
                },
                include: { images: { orderBy: { order: "asc" } } },
            });

            if (!assignment) return null;

            return {
                imagePath: assignment.imagePath,
                intervalMs: assignment.intervalMs,
                images: assignment.images.map((img: { id: string; imagePath: string; order: number }) => ({
                    id: img.id,
                    imagePath: img.imagePath,
                    order: img.order,
                })),
            };
        }),

    // Set slideshow configuration (images + interval)
    setSlideshow: protectedProcedure
        .input(z.object({
            screenId: z.string(),
            scenario: z.string(),
            images: z.array(z.string()).min(1),
            intervalMs: z.number().min(1000).max(60000).nullable(),
        }))
        .mutation(async ({ input }) => {
            const { screenId, scenario, images, intervalMs } = input;

            // Use first image as main imagePath for backward compatibility
            const imagePath = images[0];

            // Upsert the assignment
            const assignment = await prisma.scenarioAssignment.upsert({
                where: {
                    screenId_scenario: { screenId, scenario },
                },
                update: {
                    imagePath,
                    intervalMs: images.length > 1 ? intervalMs : null,
                },
                create: {
                    screenId,
                    scenario,
                    imagePath,
                    intervalMs: images.length > 1 ? intervalMs : null,
                },
            });

            // Delete existing slideshow images
            await prisma.slideshowImage.deleteMany({
                where: { assignmentId: assignment.id },
            });

            // Create new slideshow images (only if more than 1 image)
            if (images.length > 1) {
                await prisma.slideshowImage.createMany({
                    data: images.map((img, index) => ({
                        assignmentId: assignment.id,
                        imagePath: img,
                        order: index,
                    })),
                });
            }

            invalidateScenarioCache(screenId, scenario);
            const activeState = await prisma.screenState.findUnique({
                where: { screenId },
            });
            if (activeState?.scenario === scenario) {
                await prisma.screenState.update({
                    where: { screenId },
                    data: { imageSrc: imagePath, scenario },
                });
                invalidateStateCache(screenId);
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }

            return {
                ...assignment,
                images: images.map((img, index) => ({ imagePath: img, order: index })),
            };
        }),

    // Add a single image to slideshow
    addSlideshowImage: protectedProcedure
        .input(z.object({
            screenId: z.string(),
            scenario: z.string(),
            imagePath: z.string(),
        }))
        .mutation(async ({ input }) => {
            const assignment = await prisma.scenarioAssignment.findUnique({
                where: {
                    screenId_scenario: {
                        screenId: input.screenId,
                        scenario: input.scenario,
                    },
                },
                include: { images: { orderBy: { order: "desc" }, take: 1 } },
            });

            if (!assignment) {
                throw new Error("Assignment not found");
            }

            const maxOrder = assignment.images[0]?.order ?? -1;

            const newImage = await prisma.slideshowImage.create({
                data: {
                    assignmentId: assignment.id,
                    imagePath: input.imagePath,
                    order: maxOrder + 1,
                },
            });

            // Set default interval if not set and this is the second image
            if (!assignment.intervalMs) {
                await prisma.scenarioAssignment.update({
                    where: { id: assignment.id },
                    data: { intervalMs: 5000 },
                });
            }

            invalidateScenarioCache(input.screenId, input.scenario);

            const activeState = await prisma.screenState.findUnique({
                where: { screenId: input.screenId },
            });
            if (activeState?.scenario === input.scenario) {
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }

            return newImage;
        }),

    removeSlideshowImage: protectedProcedure
        .input(z.object({ imageId: z.string() }))
        .mutation(async ({ input }) => {
            const image = await prisma.slideshowImage.findUnique({
                where: { id: input.imageId },
                include: { assignment: { include: { images: true } } },
            });

            if (!image) {
                throw new Error("Image not found");
            }

            await prisma.slideshowImage.delete({
                where: { id: input.imageId },
            });

            // If this was the last slideshow image, clear interval
            if (image.assignment.images.length <= 1) {
                await prisma.scenarioAssignment.update({
                    where: { id: image.assignmentId },
                    data: { intervalMs: null },
                });
            }

            invalidateScenarioCache(image.assignment.screenId, image.assignment.scenario);

            const activeState = await prisma.screenState.findUnique({
                where: { screenId: image.assignment.screenId },
            });
            if (activeState?.scenario === image.assignment.scenario) {
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }

            return { success: true };
        }),

    updateSlideshowOrder: protectedProcedure
        .input(z.object({
            screenId: z.string(),
            scenario: z.string(),
            imageIds: z.array(z.string()),
        }))
        .mutation(async ({ input }) => {
            const assignment = await prisma.scenarioAssignment.findUnique({
                where: {
                    screenId_scenario: {
                        screenId: input.screenId,
                        scenario: input.scenario,
                    },
                },
            });

            if (!assignment) {
                throw new Error("Assignment not found");
            }

            // Update order for each image
            await Promise.all(
                input.imageIds.map((id, index) =>
                    prisma.slideshowImage.update({
                        where: { id },
                        data: { order: index },
                    })
                )
            );

            // Update main imagePath to first image
            const firstImage = await prisma.slideshowImage.findFirst({
                where: { assignmentId: assignment.id },
                orderBy: { order: "asc" },
            });

            if (firstImage) {
                await prisma.scenarioAssignment.update({
                    where: { id: assignment.id },
                    data: { imagePath: firstImage.imagePath },
                });
            }

            invalidateScenarioCache(input.screenId, input.scenario);

            const activeState = await prisma.screenState.findUnique({
                where: { screenId: input.screenId },
            });
            if (activeState?.scenario === input.scenario) {
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }

            return { success: true };
        }),

    // Update slideshow interval
    setInterval: protectedProcedure
        .input(z.object({
            screenId: z.string(),
            scenario: z.string(),
            intervalMs: z.number().min(1000).max(60000).nullable(),
        }))
        .mutation(async ({ input }) => {
            const assignment = await prisma.scenarioAssignment.update({
                where: {
                    screenId_scenario: {
                        screenId: input.screenId,
                        scenario: input.scenario,
                    },
                },
                data: { intervalMs: input.intervalMs },
            });
            invalidateScenarioCache(input.screenId, input.scenario);

            const activeState = await prisma.screenState.findUnique({
                where: { screenId: input.screenId },
            });
            if (activeState?.scenario === input.scenario) {
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }
            return assignment;
        }),
});

// Scenario names router - manage persistent scenario/scene names
export const scenarioNamesRouter = router({
    list: publicProcedure.query(async () => {
        return prisma.scenario.findMany({
            orderBy: { displayOrder: "asc" },
        });
    }),

    create: protectedProcedure
        .input(z.object({
            name: z.string().min(1),
            displayOrder: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
            // Get max displayOrder if not provided
            let order = input.displayOrder;
            if (order === undefined) {
                const max = await prisma.scenario.findFirst({
                    orderBy: { displayOrder: "desc" },
                });
                order = (max?.displayOrder ?? 0) + 1;
            }
            return prisma.scenario.create({
                data: { name: input.name, displayOrder: order },
            });
        }),

    rename: protectedProcedure
        .input(z.object({
            oldName: z.string(),
            newName: z.string().min(1),
        }))
        .mutation(async ({ input }) => {
            // Update the scenario name
            const updated = await prisma.scenario.update({
                where: { name: input.oldName },
                data: { name: input.newName },
            });

            // Update all ScenarioAssignments that reference this scenario
            await prisma.scenarioAssignment.updateMany({
                where: { scenario: input.oldName },
                data: { scenario: input.newName },
            });
            const stateUpdate = await prisma.screenState.updateMany({
                where: { scenario: input.oldName },
                data: { scenario: input.newName },
            });
            invalidateScenarioCache();
            if (stateUpdate.count > 0) {
                invalidateStateCache();
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }

            return updated;
        }),

    delete: protectedProcedure
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => {
            // Delete all assignments for this scenario
            await prisma.scenarioAssignment.deleteMany({
                where: { scenario: input.name },
            });
            const stateUpdate = await prisma.screenState.updateMany({
                where: { scenario: input.name },
                data: { imageSrc: null, scenario: null },
            });
            invalidateScenarioCache();
            // Delete the scenario
            await prisma.scenario.delete({
                where: { name: input.name },
            });
            if (stateUpdate.count > 0) {
                invalidateStateCache();
                const { broadcastState } = await import("../services/screenState.js");
                await broadcastState();
            }
            return { success: true };
        }),

    // Seed default scenarios if none exist
    seedDefaults: protectedProcedure.mutation(async () => {
        const count = await prisma.scenario.count();
        if (count === 0) {
            const defaults = ["Scene 1", "Scene 2", "Scene 3"];
            for (let i = 0; i < defaults.length; i++) {
                await prisma.scenario.create({
                    data: { name: defaults[i], displayOrder: i },
                });
            }
            return { created: defaults.length };
        }
        return { created: 0 };
    }),
});

// VNNOX router
export const vnnoxRouter = router({
    isEnabled: publicProcedure.query(() => {
        return { enabled: isVnnoxEnabled() };
    }),

    listPlayers: protectedProcedure
        .input(z.object({
            count: z.number().min(1).max(200).default(50),
            start: z.number().min(0).default(0),
            name: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
            if (!isVnnoxEnabled()) {
                throw new TRPCError({ code: "PRECONDITION_FAILED", message: "VNNOX niet geconfigureerd" });
            }
            return fetchPlayerList({
                count: input?.count || 50,
                start: input?.start || 0,
                name: input?.name,
            });
        }),

    linkPlayer: protectedProcedure
        .input(z.object({
            screenId: z.string(),
            playerId: z.string(),
            playerName: z.string(),
        }))
        .mutation(async ({ input }) => {
            if (!isVnnoxEnabled()) {
                throw new TRPCError({ code: "PRECONDITION_FAILED", message: "VNNOX niet geconfigureerd" });
            }

            // Check if player is already linked to another screen
            const existing = await prisma.screen.findUnique({
                where: { vnnoxPlayerId: input.playerId },
            });
            if (existing && existing.id !== input.screenId) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `Player is al gekoppeld aan scherm "${existing.name || existing.id}"`,
                });
            }

            const screen = await prisma.screen.update({
                where: { id: input.screenId },
                data: {
                    vnnoxPlayerId: input.playerId,
                    vnnoxPlayerName: input.playerName,
                    vnnoxOnlineStatus: 0,
                    vnnoxLastSeen: null,
                },
            });
            invalidateScreensCache(screen.displayId);
            return screen;
        }),

    unlinkPlayer: protectedProcedure
        .input(z.object({ screenId: z.string() }))
        .mutation(async ({ input }) => {
            const screen = await prisma.screen.update({
                where: { id: input.screenId },
                data: {
                    vnnoxPlayerId: null,
                    vnnoxPlayerName: null,
                    vnnoxOnlineStatus: null,
                    vnnoxLastSeen: null,
                },
            });
            invalidateScreensCache(screen.displayId);
            return screen;
        }),

    getStatuses: publicProcedure.query(async () => {
        const screens = await prisma.screen.findMany({
            where: { vnnoxPlayerId: { not: null } },
            select: {
                id: true,
                vnnoxPlayerId: true,
                vnnoxPlayerName: true,
                vnnoxOnlineStatus: true,
                vnnoxLastSeen: true,
            },
        });

        const statuses: Record<string, {
            playerId: string;
            playerName: string | null;
            onlineStatus: number | null;
            lastSeen: Date | null;
        }> = {};

        for (const screen of screens) {
            statuses[screen.id] = {
                playerId: screen.vnnoxPlayerId!,
                playerName: screen.vnnoxPlayerName,
                onlineStatus: screen.vnnoxOnlineStatus,
                lastSeen: screen.vnnoxLastSeen,
            };
        }

        return statuses;
    }),
});

// Main app router
export const appRouter = router({
    auth: authRouter,
    displays: displayRouter,
    screens: screenRouter,
    presets: presetRouter,
    state: stateRouter,
    content: contentRouter,
    scenarios: scenariosRouter,
    scenarioNames: scenarioNamesRouter,
    vnnox: vnnoxRouter,
});

export type AppRouter = typeof appRouter;
