import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../prisma/client.js";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Display router
export const displayRouter = router({
    list: publicProcedure.query(async () => {
        return prisma.display.findMany({
            orderBy: { id: "asc" },
            include: { _count: { select: { screens: true } } },
        });
    }),

    create: publicProcedure
        .input(z.object({
            id: z.string().optional(),
            name: z.string().min(1),
        }))
        .mutation(async ({ input }) => {
            // Auto-generate ID if not provided
            const id = input.id?.trim() || `disp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
            return prisma.display.create({
                data: { id, name: input.name },
            });
        }),

    update: publicProcedure
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

    delete: publicProcedure
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
    initFromScreens: publicProcedure.mutation(async () => {
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

    update: publicProcedure
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

    create: publicProcedure
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
            // Generate a unique ID using timestamp + random suffix
            const id = `scr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
            return prisma.screen.create({ data: { id, ...input } });
        }),

    delete: publicProcedure
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
            screens: screens.map(s => ({
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

    importScreens: publicProcedure
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
            const results = {
                created: 0,
                updated: 0,
                skipped: 0,
                errors: [] as string[],
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
        const presets = await prisma.preset.findMany();
        return presets.map((p: { id: string; name: string; screens: string }) => ({
            ...p,
            screens: z.record(z.string(), z.string()).parse(JSON.parse(p.screens)),
        }));
    }),

    activate: publicProcedure
        .input(z.object({ presetId: z.string() }))
        .mutation(async ({ input }) => {
            const preset = await prisma.preset.findUnique({
                where: { id: input.presetId },
            });
            if (!preset) throw new Error("Preset not found");

            const screens = z.record(z.string(), z.string()).parse(JSON.parse(preset.screens));

            // Update all screen states
            for (const [screenId, imageSrc] of Object.entries(screens)) {
                await prisma.screenState.upsert({
                    where: { screenId },
                    update: { imageSrc },
                    create: { screenId, imageSrc },
                });
            }

            return { success: true, screens };
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

    set: publicProcedure
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
        return contents.map((c) => c.category);
    }),

    delete: publicProcedure
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

    toggleFavorite: publicProcedure
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

    rename: publicProcedure
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
                if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
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
                assignments.map((a) => [a.scenario, a.imagePath])
            );
        }),

    set: publicProcedure
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

    delete: publicProcedure
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

    create: publicProcedure
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

    rename: publicProcedure
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

    delete: publicProcedure
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
    seedDefaults: publicProcedure.mutation(async () => {
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
    displays: displayRouter,
    screens: screenRouter,
    presets: presetRouter,
    state: stateRouter,
    content: contentRouter,
    scenarios: scenariosRouter,
    scenarioNames: scenarioNamesRouter,
});

export type AppRouter = typeof appRouter;
