import { createHash, randomBytes } from "crypto";
import { logger } from "../utils/logger.js";

const VNNOX_APP_KEY = process.env.VNNOX_APP_KEY || "";
const VNNOX_APP_SECRET = process.env.VNNOX_APP_SECRET || "";
const VNNOX_API_URL = process.env.VNNOX_API_URL || "https://open-eu.vnnox.com";

export function isVnnoxEnabled(): boolean {
    return !!(VNNOX_APP_KEY && VNNOX_APP_SECRET);
}

function getAuthHeaders(): Record<string, string> {
    const nonce = randomBytes(16).toString("hex");
    const curTime = Math.floor(Date.now() / 1000).toString();
    const checkSum = createHash("sha256")
        .update(VNNOX_APP_SECRET + nonce + curTime)
        .digest("hex");

    return {
        AppKey: VNNOX_APP_KEY,
        Nonce: nonce,
        CurTime: curTime,
        CheckSum: checkSum,
        "Content-Type": "application/json",
    };
}
// Raw API response format from VNNOX
interface VnnoxPlayerApiResponse {
    playerId: string;
    playerType?: number;
    name: string;
    sn?: string;
    version?: string;
    ip?: string;
    onlineStatus?: number;
    lastOnlineTime?: string;
}

// Frontend-friendly format (maps API fields to expected names)
export interface VnnoxPlayer {
    playerId: string;
    playerName: string;
    terminalIp?: string;
    terminalSn?: string;
    firmwareVersion?: string;
    onlineStatus?: number;
    lastOnlineTime?: string;
}

// Map API response to frontend format
function mapPlayerToFrontend(player: VnnoxPlayerApiResponse): VnnoxPlayer {
    return {
        playerId: player.playerId,
        playerName: player.name,
        terminalIp: player.ip,
        terminalSn: player.sn,
        firmwareVersion: player.version,
        onlineStatus: player.onlineStatus,
        lastOnlineTime: player.lastOnlineTime,
    };
}

interface VnnoxListResponse {
    errorCode?: number;
    errorMsg?: string;
    pageInfo?: { start: number; count: number };
    total?: number;
    rows?: VnnoxPlayerApiResponse[];
}

interface VnnoxOnlineStatusItem {
    playerId: string;
    sn?: string;
    onlineStatus: number;
    lastOnlineTime?: string;
}

interface VnnoxOnlineStatusError {
    errorCode: number;
    errorMsg?: string;
}

// Response can be either an array (success) or an error object
type VnnoxOnlineStatusResponse = VnnoxOnlineStatusItem[] | VnnoxOnlineStatusError;

export async function fetchPlayerList(params: {
    count?: number;
    start?: number;
    name?: string;
}): Promise<{ total: number; players: VnnoxPlayer[] }> {
    const query = new URLSearchParams();
    query.set("count", String(params.count || 50));
    query.set("start", String(params.start || 0));
    if (params.name) {
        query.set("name", params.name);
    }

    const url = `${VNNOX_API_URL}/v2/player/list?${query.toString()}`;

    logger.info(`VNNOX: Fetching player list from ${url}`);

    const res = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        const errorText = await res.text();
        logger.error(`VNNOX API error: ${res.status} ${res.statusText} - ${errorText}`);
        throw new Error(`VNNOX API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as VnnoxListResponse;

    logger.info(`VNNOX: Player list response - errorCode: ${body.errorCode}, total: ${body.total}, rows: ${body.rows?.length || 0}`);

    // Check for error response (errorCode is only present on error, or 0 on success)
    if (body.errorCode !== undefined && body.errorCode !== 0) {
        throw new Error(`VNNOX API error: ${body.errorCode} ${body.errorMsg || ""}`);
    }

    return {
        total: body.total || 0,
        players: (body.rows || []).map(mapPlayerToFrontend),
    };
}

export async function fetchOnlineStatuses(
    playerIds: string[]
): Promise<Array<{ playerId: string; onlineStatus: number; lastOnlineTime?: string }>> {
    if (playerIds.length === 0) return [];

    const url = `${VNNOX_API_URL}/v2/player/current/online-status`;

    logger.info(`VNNOX: Fetching online statuses for ${playerIds.length} players`);

    const res = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ playerIds }),
    });

    if (!res.ok) {
        const errorText = await res.text();
        logger.error(`VNNOX API error: ${res.status} ${res.statusText} - ${errorText}`);
        throw new Error(`VNNOX API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as VnnoxOnlineStatusResponse;

    // Check if response is an error object (has errorCode property)
    if (!Array.isArray(body)) {
        logger.warn(`VNNOX online status error: ${body.errorCode} ${body.errorMsg || ""}`);
        return [];
    }

    logger.info(`VNNOX: Received online status for ${body.length} players`);
    return body;
}
