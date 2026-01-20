import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { verifyPassword, generateToken, isAuthEnabled } from "../auth/auth.js";
import type { Context } from "./context.js";

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
            return prisma.display.create({
                data: { id, name: input.name },
            });
        }),

    update: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return prisma.display.update({
                where: { id },
                data,
            });
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
            lat: z.number().optional().nullable(), // Allow null to clear
            lng: z.number().optional().nullable(),
            address: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return prisma.screen.update({
                where: { id },
                data,
            });
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

            return prisma.screen.create({ data: { id, ...input } });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.screen.delete({ where: { id: input.id } });
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
            const updates: { screenId: string; imageSrc: string }[] = [];

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
                    updates.push({ screenId, imageSrc: assignment.imagePath });
                }
            }

            // Update all screen states
            for (const { screenId, imageSrc } of updates) {
                await prisma.screenState.upsert({
                    where: { screenId },
                    update: { imageSrc },
                    create: { screenId, imageSrc },
                });
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
        const states = await prisma.screenState.findMany();
        return Object.fromEntries(
            states.map((s: { screenId: string; imageSrc: string | null; updatedAt: Date }) => [s.screenId, { src: s.imageSrc, updated: s.updatedAt }])
        );
    }),

    set: protectedProcedure
        .input(z.object({ screenId: z.string(), imageSrc: z.string() }))
        .mutation(async ({ input }) => {
            const state = await prisma.screenState.upsert({
                where: { screenId: input.screenId },
                update: { imageSrc: input.imageSrc },
                create: { screenId: input.screenId, imageSrc: input.imageSrc },
            });
            return state;
        }),
});

// Content router
export const contentRouter = router({
    list: publicProcedure
        .input(z.object({ category: z.string().optional() }).optional())
        .query(async ({ input }) => {
            const where = input?.category ? { category: input.category } : {};
            return prisma.content.findMany({
                where,
                orderBy: { createdAt: "desc" },
            });
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
            const filePath = path.join(process.cwd(), "..", content.path);
            try {
                await fs.unlink(filePath);
            } catch {
                // File might not exist, continue with DB deletion
            }

            await prisma.content.delete({ where: { id: input.id } });
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

            // Get the actual filename from the path (not content.filename which is display name)
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
            return prisma.scenarioAssignment.upsert({
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
            return { success: true };
        }),

    // Get all assignments grouped by screen for Control page
    getAll: publicProcedure.query(async () => {
        const assignments = await prisma.scenarioAssignment.findMany();
        const grouped: Record<string, Record<string, string>> = {};

        for (const a of assignments) {
            if (!grouped[a.screenId]) {
                grouped[a.screenId] = {};
            }
            grouped[a.screenId][a.scenario] = a.imagePath;
        }

        return grouped;
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

            return updated;
        }),

    delete: protectedProcedure
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => {
            // Delete all assignments for this scenario
            await prisma.scenarioAssignment.deleteMany({
                where: { scenario: input.name },
            });
            // Delete the scenario
            await prisma.scenario.delete({
                where: { name: input.name },
            });
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
});

export type AppRouter = typeof appRouter;
