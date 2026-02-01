import { httpBatchLink, createTRPCClient } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../backend/src/trpc/router";

const TOKEN_KEY = "led_controller_auth_token";

function getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

const apiUrl = import.meta.env.VITE_API_URL || "";

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: `${apiUrl}/trpc`,
            headers: () => {
                const token = getAuthToken();
                return token ? { Authorization: `Bearer ${token}` } : {};
            },
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

// Helper function to get auth headers for non-tRPC requests (like file upload)
export function getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
