import path from "path";

/**
 * Resolves the content directory path based on environment.
 * - CONTENT_PATH env var takes priority
 * - Production (Docker): /app/content
 * - Development: ../content (relative to backend/)
 */
export const contentPath = process.env.CONTENT_PATH || (
    process.env.NODE_ENV === "production"
        ? path.join(process.cwd(), "content")   // Docker: /app/content
        : path.join(process.cwd(), "..", "content")  // Local dev: ../content
);
