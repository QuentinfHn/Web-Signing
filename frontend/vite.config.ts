import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            workbox: {
                skipWaiting: true,
                clientsClaim: true,
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,mp4,webm}"],
                cleanupOutdatedCaches: true,
                maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
                runtimeCaching: [
                    {
                        urlPattern: /^.*\/content\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "content-images",
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 90,
                                purgeOnQuotaError: true,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                            rangeRequests: true,
                        },
                    },
                    {
                        urlPattern: /^.*\/trpc\/.*/i,
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "api-responses",
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60,
                                purgeOnQuotaError: true,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                            networkTimeoutSeconds: 10,
                        },
                    },
                    {
                        urlPattern: /^.*\/api\/.*/i,
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "api-responses",
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60,
                                purgeOnQuotaError: true,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                            networkTimeoutSeconds: 10,
                        },
                    },
                    {
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "static-images",
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: /\.(?:js|css)$/i,
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "static-resources",
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 7,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
                navigateFallback: "/index.html",
                navigateFallbackDenylist: [/^\/api/, /^\/trpc/, /^\/content/, /^\/ws/],
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
