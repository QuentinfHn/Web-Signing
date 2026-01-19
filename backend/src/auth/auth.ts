import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

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
 */
export function isAuthEnabled(): boolean {
    return !!process.env.ADMIN_PASSWORD;
}

/**
 * Verify password using timing-safe comparison
 */
export function verifyPassword(inputPassword: string): boolean {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        return true; // No password set = always valid
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
        if (typeof decoded === 'object' && decoded !== null && 'authenticated' in decoded) {
            return decoded as JWTPayload;
        }
        return null;
    } catch {
        return null;
    }
}

