import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "prompt", // Don't auto-reload, signage should stay stable
            workbox: {
                skipWaiting: false, // Don't force new SW to take over
                clientsClaim: false, // Don't claim clients immediately
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
                runtimeCaching: [
                    {
                        urlPattern: /^.*\/content\/.*/i,
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "content-images",
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
            manifest: false,
        }),
    ],
    server: {
        port: 3000,
        proxy: {
            "/trpc": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
            "/content/": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
            "/api": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
            "/ws": {
                target: "ws://localhost:8080",
                ws: true,
                rewriteWsOrigin: true,
            },
        },
    },
});
