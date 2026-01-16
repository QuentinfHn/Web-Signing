import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            "/trpc": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
            "/content": {
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
