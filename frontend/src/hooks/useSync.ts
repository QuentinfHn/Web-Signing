import { useState, useEffect, useCallback } from 'react';
import { signageCache } from '../lib/signageCache';
import { retry, RetryOptions } from '../lib/retry';
import { trpcClient } from '../utils/trpc';
import { ScreenState } from '../utils/websocket';

const networkRetryOptions: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    shouldRetry: (error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        return message.includes('network') || message.includes('fetch');
    }
};

export interface UseSyncResult {
    isSyncing: boolean;
    lastSync: Date | null;
    lastError: string | null;
    sync: () => Promise<boolean>;
    syncStatus: { isSyncing: boolean; lastSync: Date | null; lastError: string | null };
}

export function useSync(displayId: string): UseSyncResult {
    const [syncStatus, setSyncStatus] = useState({
        isSyncing: false,
        lastSync: null as Date | null,
        lastError: null as string | null
    });

    useEffect(() => {
        const unsubscribe = signageCache.onSyncStatusChange((status) => {
            setSyncStatus(status);
        });

        return unsubscribe;
    }, []);

    const sync = useCallback(async (): Promise<boolean> => {
        return await signageCache.syncWithServer(displayId, {
            displays: async () => {
                return await retry(async () => {
                    const displays = await trpcClient.displays.list.query();
                    return displays.map(d => ({
                        id: d.id,
                        name: d.name || '',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }));
                }, networkRetryOptions);
            },
            screens: async () => {
                return await retry(async () => {
                    const screens = await trpcClient.screens.getByDisplay.query({ displayId });
                    return screens.map(s => ({
                        id: s.id,
                        displayId: s.displayId,
                        name: s.name,
                        x: s.x,
                        y: s.y,
                        width: s.width,
                        height: s.height
                    }));
                }, networkRetryOptions);
            },
            states: async () => {
                return await retry(async () => {
                    const states = await trpcClient.state.getAll.query();
                    const entries = Object.entries(states);
                    const hasScenario = entries.some(([, state]) =>
                        Object.prototype.hasOwnProperty.call(state as Record<string, unknown>, "scenario")
                    );
                    const cachedStates = !hasScenario && entries.length > 0
                        ? await signageCache.loadStates()
                        : null;
                    const stateMap: ScreenState = {};
                    entries.forEach(([screenId, state]) => {
                        const typed = state as {
                            src: string | null;
                            scenario?: string | null;
                            updated: Date | string;
                            slideshow?: { images: string[]; intervalMs: number };
                        };
                        const cached = cachedStates?.[screenId];
                        const scenario = hasScenario ? (typed.scenario ?? null) : (cached?.scenario ?? null);
                        const slideshow = hasScenario ? typed.slideshow : cached?.slideshow;
                        stateMap[screenId] = {
                            src: typed.src,
                            scenario,
                            updated: typed.updated,
                            slideshow
                        };
                    });
                    return stateMap;
                }, networkRetryOptions);
            }
        });
    }, [displayId]);

    return {
        isSyncing: syncStatus.isSyncing,
        lastSync: syncStatus.lastSync,
        lastError: syncStatus.lastError,
        sync,
        syncStatus
    };
}

export function useAutoSync(displayId: string, interval: number = 60000) {
    const { isSyncing, sync } = useSync(displayId);

    // Immediate sync on mount
    useEffect(() => {
        sync();
    }, [displayId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Periodic sync
    useEffect(() => {
        if (isSyncing) return;

        const intervalId = setInterval(async () => {
            if (!isSyncing) {
                await sync();
            }
        }, interval);

        return () => clearInterval(intervalId);
    }, [displayId, interval, isSyncing, sync]);

    return { isSyncing };
}
