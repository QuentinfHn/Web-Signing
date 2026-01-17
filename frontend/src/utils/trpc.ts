import { httpBatchLink, createTRPCClient } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
// Import Type from backend - assuming backend is capable of exporting it (monorepo style or relative import if possible)
// Since this is a separate package but in same repo, we might need relative path or just copy types if we can't import.
// However, typically in this setup we rely on the backend being available.
// Let's assume relative import works or we need to fix tsconfig references.
// For now, I will try to import from the backend relative path, but standard is to have a shared package.
// Given the structure, I will attempt to reference the backend type if possible, or defined it.
// Actually, looking at the previous file content, it was just defining local types.
// A better approach is to leverage tRPC's direct type sharing if configured, usually via a shared package or npm workspace.
// Users' workspace has backend and frontend as siblings.
// I will try to import from relative path BUT this might fail in browser build if not careful.
// SAFEST BET: define the client with `any` for now BUT keep existing manual types, 
// OR better: use the types defined right there but remove `any` from the `createTRPCClient` call if possible or cast it to a generic interface?
// NO, the goal is "Remove all usages of any".
// If I can't import AppRouter, I must define a compatible interface.
// Let's look at `AppRouter` in backend.
// It is exported.
// I will try to import it using a type-only import which might work if tsconfig allows.
import type { AppRouter } from "../../../backend/src/trpc/router";

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: "/trpc",
        }),
    ],
});

export type RouterOutput = inferRouterOutputs<AppRouter>;

// Export aliases for convenience, matching previous manual types where possible
export type Display = RouterOutput["displays"]["list"][number];
export type Screen = RouterOutput["screens"]["list"][number];
export type Preset = RouterOutput["presets"]["list"][number];
export type Content = RouterOutput["content"]["list"][number];
export type Scenario = RouterOutput["scenarioNames"]["list"][number];

