import { NextFunction, Request, Response } from "express";
import { verifyToken, isAuthEnabled } from "../auth/auth.js";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthEnabled()) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Authenticatie vereist" });
        return;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
        res.status(401).json({ error: "Ongeldige of verlopen sessie" });
        return;
    }

    next();
};
