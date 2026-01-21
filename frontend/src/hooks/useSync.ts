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
                    const stateMap: ScreenState = {};
                    Object.entries(states).forEach(([screenId, state]: [string, any]) => {
                        stateMap[screenId] = {
                            src: state.src,
                            scenario: null,
                            updated: state.updated
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
