import { httpBatchLink, createTRPCClient } from "@trpc/client";

// Simple untyped tRPC client for local use
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpcClient = createTRPCClient<any>({
    links: [
        httpBatchLink({
            url: "/trpc",
        }),
    ],
});

// Types for use in components
export type Display = {
    id: string;
    name: string | null;
    _count?: { screens: number };
};

export type Screen = {
    id: string;
    displayId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    name: string | null;
    lat: number | null;
    lng: number | null;
    address: string | null;
};

export type Preset = {
    id: string;
    name: string;
    screens: Record<string, string>;
};

export type Content = {
    id: string;
    filename: string;
    path: string;
    category: string;
    mimeType: string;
    size: number;
    createdAt: string;
};
