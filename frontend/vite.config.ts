import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate", // Auto-update for Kiosk mode
            workbox: {
                skipWaiting: true, // Force new SW to take over immediately
                clientsClaim: true, // Claim clients immediately
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
                cleanupOutdatedCaches: true,
                runtimeCaching: [
                    {
                        urlPattern: /^.*\/content\/.*/i,
                        handler: "StaleWhileRevalidate", // Better for offline: serves cache while updating in bg
                        options: {
                            cacheName: "content-images",
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
            manifest: {
                name: "LED Controller",
                short_name: "LED",
                theme_color: "#000000",
                background_color: "#000000",
                display: "fullscreen",
                orientation: "landscape",
                start_url: "/",
                scope: "/",
            },
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
