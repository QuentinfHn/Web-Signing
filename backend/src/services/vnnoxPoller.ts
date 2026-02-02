import { prisma } from "../prisma/client.js";
import { isVnnoxEnabled, fetchOnlineStatuses } from "./vnnox.js";
import { logger } from "../utils/logger.js";

const POLL_INTERVAL = 15_000; // 15 seconds
const BATCH_SIZE = 100;

type StatusChangeCallback = (
    statuses: Record<string, { playerId: string; onlineStatus: number; lastSeen: string | null }>
) => void;

let statusChangeCallback: StatusChangeCallback | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function setStatusChangeCallback(cb: StatusChangeCallback) {
    statusChangeCallback = cb;
}

async function pollStatuses() {
    try {
        const screens = await prisma.screen.findMany({
            where: { vnnoxPlayerId: { not: null } },
            select: { id: true, vnnoxPlayerId: true, vnnoxOnlineStatus: true },
        });

        if (screens.length === 0) return;

        const playerIds = screens
            .map((s) => s.vnnoxPlayerId)
            .filter((id): id is string => id !== null);

        // Batch player IDs in groups of BATCH_SIZE
        const allStatuses: Array<{ playerId: string; onlineStatus: number; lastOnlineTime?: string }> = [];

        for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
            const batch = playerIds.slice(i, i + BATCH_SIZE);
            const batchStatuses = await fetchOnlineStatuses(batch);
            allStatuses.push(...batchStatuses);
        }

        // Map playerId -> status data
        const statusMap = new Map(
            allStatuses.map((s) => [s.playerId, s])
        );

        // Track changes for WebSocket broadcast
        const changes: Record<string, { playerId: string; onlineStatus: number; lastSeen: string | null }> = {};

        for (const screen of screens) {
            if (!screen.vnnoxPlayerId) continue;

            const status = statusMap.get(screen.vnnoxPlayerId);
            if (!status) continue;

            const newOnlineStatus = status.onlineStatus;
            const lastOnlineTime = status.lastOnlineTime || null;
            const parsedLastSeen = lastOnlineTime ? new Date(lastOnlineTime) : null;

            // Always update lastSeen if we have new data, but only track status changes for broadcast
            const statusChanged = screen.vnnoxOnlineStatus !== newOnlineStatus;
            const needsUpdate = statusChanged || (parsedLastSeen && !screen.vnnoxOnlineStatus);

            if (needsUpdate || lastOnlineTime) {
                await prisma.screen.update({
                    where: { id: screen.id },
                    data: {
                        vnnoxOnlineStatus: newOnlineStatus,
                        vnnoxLastSeen: parsedLastSeen ?? undefined,
                    },
                });
            }

            // Only broadcast if status actually changed
            if (statusChanged) {
                changes[screen.id] = {
                    playerId: screen.vnnoxPlayerId,
                    onlineStatus: newOnlineStatus,
                    lastSeen: lastOnlineTime,
                };
            }
        }

        if (Object.keys(changes).length > 0 && statusChangeCallback) {
            statusChangeCallback(changes);
        }
    } catch (error) {
        logger.error("VNNOX polling error:", error);
    }
}

export function startVnnoxPoller() {
    if (!isVnnoxEnabled()) {
        logger.info("VNNOX not configured, skipping poller");
        return;
    }

    logger.info("Starting VNNOX status poller (15s interval)");

    // Initial poll
    pollStatuses();

    // Schedule recurring polls
    pollInterval = setInterval(pollStatuses, POLL_INTERVAL);
}

export function stopVnnoxPoller() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}
