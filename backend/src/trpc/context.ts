import type { Request } from "express";
import { verifyToken, isAuthEnabled } from "../auth/auth.js";

export interface Context {
    isAuthenticated: boolean;
    authRequired: boolean;
    ip: string;
}

/**
 * Create tRPC context from Express request
 * Extracts Authorization header and validates JWT token
 */
export function createContext({ req }: { req: Request }): Context {
    const authRequired = isAuthEnabled();
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    // If auth is not enabled, everyone is authenticated
    if (!authRequired) {
        return { isAuthenticated: true, authRequired: false, ip };
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return { isAuthenticated: false, authRequired: true, ip };
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    return {
        isAuthenticated: payload !== null,
        authRequired: true,
        ip,
    };
}
