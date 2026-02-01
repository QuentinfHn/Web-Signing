import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger.js";

const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const loginRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: MAX_ATTEMPTS,
    message: { error: "Te veel login pogingen. Probeer opnieuw over 15 minuten." },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ error: "Te veel login pogingen. Probeer opnieuw over 15 minuten." });
    },
});

export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`API rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ error: "Te veel verzoeken. Probeer opnieuw over enkele minuten." });
    },
});

// Higher rate limit for Companion integration (polling services need more requests)
export const companionRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // 1000 requests per 15 minutes for polling
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Companion rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ error: "Too many requests. Try again later." });
    },
});

export const uploadRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ error: "Te veel uploads. Probeer opnieuw over een uur." });
    },
});
