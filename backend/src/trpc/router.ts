import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../prisma/client.js";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

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
            name: z.string().optional(),
            displayId: z.string().optional(),
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
            id: z.string(),
            displayId: z.string(),
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
            name: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            return prisma.screen.create({ data: input });
        }),

    delete: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.screen.delete({ where: { id: input.id } });
            return { success: true };
        }),
});

// Preset router
export const presetRouter = router({
    list: publicProcedure.query(async () => {
        const presets = await prisma.preset.findMany();
        return presets.map((p: { id: string; name: string; screens: string }) => ({
            ...p,
            screens: JSON.parse(p.screens) as Record<string, string>,
        }));
    }),

    activate: publicProcedure
        .input(z.object({ presetId: z.string() }))
        .mutation(async ({ input }) => {
            const preset = await prisma.preset.findUnique({
                where: { id: input.presetId },
            });
            if (!preset) throw new Error("Preset not found");

            const screens = JSON.parse(preset.screens) as Record<string, string>;

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
            ) as Record<string, string>;
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

// Main app router
export const appRouter = router({
    screens: screenRouter,
    presets: presetRouter,
    state: stateRouter,
    content: contentRouter,
    scenarios: scenariosRouter,
});

export type AppRouter = typeof appRouter;
