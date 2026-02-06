import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

if (!process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD is required. Set ADMIN_PASSWORD environment variable to secure the API.");
}

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production. Set JWT_SECRET environment variable with a secure random string.");
}

if (!JWT_SECRET) {
    console.warn("⚠️  WARNING: JWT_SECRET not set. Using default secret for development. DO NOT USE IN PRODUCTION!");
}

const SECRET = JWT_SECRET || "default-dev-secret-change-in-production";

export interface JWTPayload {
    authenticated: true;
    iat?: number;
    exp?: number;
}

/**
 * Check if password protection is enabled (ADMIN_PASSWORD is set)
 * Note: ADMIN_PASSWORD is now required, so this always returns true
 */
export function isAuthEnabled(): boolean {
    return true; // ADMIN_PASSWORD is required at startup
}

/**
 * Verify password using timing-safe comparison
 */
export function verifyPassword(inputPassword: string): boolean {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        return false; // No password set = reject (should never happen due to startup check)
    }

    // Use timing-safe comparison to prevent timing attacks
    const inputBuffer = Buffer.from(inputPassword);
    const passwordBuffer = Buffer.from(adminPassword);

    // If lengths differ, we still need to compare to prevent timing leak
    if (inputBuffer.length !== passwordBuffer.length) {
        // Compare with itself to spend similar time
        crypto.timingSafeEqual(inputBuffer, inputBuffer);
        return false;
    }

    return crypto.timingSafeEqual(inputBuffer, passwordBuffer);
}

/**
 * Generate a JWT token for authenticated session
 */
export function generateToken(): string {
    const payload: JWTPayload = { authenticated: true };
    return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, SECRET);
        if (typeof decoded === 'object' && decoded !== null && 'authenticated' in decoded && decoded.authenticated === true) {
            return decoded as JWTPayload;
        }
        return null;
    } catch {
        return null;
    }
}

