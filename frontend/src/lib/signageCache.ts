import { cacheDB, CacheDisplay, CacheScreen, CacheState } from './cacheDB';
import { ScreenState } from '../utils/websocket';

interface SyncStatus {
    isSyncing: boolean;
    lastSync: Date | null;
    lastError: string | null;
}

interface CachedScreen {
    id: string;
    displayId: string;
    name: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
}

class SignageCache {
    private syncStatus: SyncStatus = {
        isSyncing: false,
        lastSync: null,
        lastError: null
    };

    private syncCallbacks: Set<(status: SyncStatus) => void> = new Set();
    private prefetchedUrls: Set<string> = new Set();
    private prefetchInFlight: Set<string> = new Set();
    private readonly PREFETCH_CONCURRENCY = 4;

    async initialize(): Promise<boolean> {
        try {
            await cacheDB.init();
            return true;
        } catch (error) {
            console.error('Failed to initialize cache:', error);
            return false;
        }
    }

    onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
        this.syncCallbacks.add(callback);
        return () => {
            this.syncCallbacks.delete(callback);
        };
    }

    private notifySyncStatusChange(): void {
        this.syncCallbacks.forEach((callback) => {
            try {
                callback({ ...this.syncStatus });
            } catch (error) {
                console.error('Error in sync status callback:', error);
            }
        });
    }

    private shouldPrefetch(url: string): boolean {
        if (typeof window === 'undefined') return false;
        if (!url) return false;
        try {
            const resolved = new URL(url, window.location.origin);
            return resolved.origin === window.location.origin && resolved.pathname.startsWith('/content/');
        } catch (error) {
            console.error('Failed to parse prefetch URL:', error);
            return false;
        }
    }

    private async prefetchUrls(urls: string[]): Promise<void> {
        if (typeof fetch === 'undefined' || typeof navigator === 'undefined') return;
        if (navigator.onLine === false) return;

        const unique = Array.from(new Set(urls));
        const queue = unique.filter((url) =>
            this.shouldPrefetch(url) && !this.prefetchedUrls.has(url) && !this.prefetchInFlight.has(url)
        );

        if (queue.length === 0) return;

        queue.forEach((url) => this.prefetchInFlight.add(url));

        const worker = async () => {
            while (queue.length > 0) {
                const url = queue.shift();
                if (!url) continue;
                try {
                    const response = await fetch(url);
                    if (response.ok || response.type === 'opaque') {
                        this.prefetchedUrls.add(url);
                    }
                } catch (error) {
                    console.error('Failed to prefetch content:', error);
                } finally {
                    this.prefetchInFlight.delete(url);
                }
            }
        };

        const concurrency = Math.min(this.PREFETCH_CONCURRENCY, queue.length);
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
    }

    async warmContentCache(states: ScreenState): Promise<void> {
        if (!states || Object.keys(states).length === 0) return;
        const urls: string[] = [];

        Object.values(states).forEach((state) => {
            if (state.src) {
                urls.push(state.src);
            }
            if (state.slideshow?.images?.length) {
                urls.push(...state.slideshow.images);
            }
        });

        await this.prefetchUrls(urls);
    }

    async loadDisplays(): Promise<CacheDisplay[]> {
        try {
            const displays = await cacheDB.getAllDisplays();
            return displays;
        } catch (error) {
            console.error('Failed to load displays from cache:', error);
            return [];
        }
    }

    async loadScreens(displayId: string): Promise<CachedScreen[]> {
        try {
            const cachedScreens = await cacheDB.getScreensByDisplayId(displayId);
            return cachedScreens.map((s) => ({
                id: s.id,
                displayId: s.displayId,
                name: s.name,
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height
            }));
        } catch (error) {
            console.error('Failed to load screens from cache:', error);
            return [];
        }
    }

    async loadStates(): Promise<ScreenState> {
        try {
            const cachedStates = await cacheDB.getAllStates();
            const states: ScreenState = {};

            Object.entries(cachedStates).forEach(([screenId, state]) => {
                states[screenId] = {
                    src: state.src,
                    scenario: state.scenario,
                    updated: new Date(state.updated),
                    slideshow: state.slideshow
                };
            });

            return states;
        } catch (error) {
            console.error('Failed to load states from cache:', error);
            return {};
        }
    }

    async cacheDisplays(displays: CacheDisplay[]): Promise<void> {
        try {
            await cacheDB.putDisplays(displays);
        } catch (error) {
            console.error('Failed to cache displays:', error);
            throw error;
        }
    }

    async cacheScreens(screens: CachedScreen[], displayId: string): Promise<void> {
        try {
            const cachedScreens = await cacheDB.getScreensByDisplayId(displayId);
            const incomingIds = new Set(screens.map((screen) => screen.id));
            const staleIds = cachedScreens
                .filter((screen) => !incomingIds.has(screen.id))
                .map((screen) => screen.id);

            if (staleIds.length > 0) {
                await cacheDB.deleteScreensAndStates(staleIds);
            }

            const screensToCache: CacheScreen[] = screens.map((screen) => ({
                id: screen.id,
                displayId: screen.displayId,
                name: screen.name || '',
                x: screen.x,
                y: screen.y,
                width: screen.width,
                height: screen.height,
                contentId: null,
                updatedAt: new Date().toISOString()
            }));

            await cacheDB.putScreens(screensToCache);

            const metadata = await cacheDB.getMetadata();
            const currentDisplayIds = metadata?.displayIds || [];
            if (!currentDisplayIds.includes(displayId)) {
                await cacheDB.updateMetadata({
                    id: 'meta',
                    version: 1,
                    lastUpdated: new Date().toISOString(),
                    displayIds: [...currentDisplayIds, displayId]
                });
            }
        } catch (error) {
            console.error('Failed to cache screens:', error);
            throw error;
        }
    }

    async cacheStates(states: ScreenState): Promise<void> {
        try {
            const cacheStates: Record<string, CacheState> = {};

            Object.entries(states).forEach(([screenId, state]) => {
                cacheStates[screenId] = {
                    screenId,
                    src: state.src,
                    scenario: state.scenario,
                    updated: state.updated instanceof Date ? state.updated.toISOString() : state.updated as string,
                    slideshow: state.slideshow
                };
            });

            await cacheDB.putStates(cacheStates);

            // Warm the Service Worker cache for offline playback.
            void this.warmContentCache(states).catch((error) => {
                console.error('Failed to warm content cache:', error);
            });
        } catch (error) {
            console.error('Failed to cache states:', error);
            throw error;
        }
    }

    async syncWithServer(displayId: string, fetchFn: {
        displays: () => Promise<CacheDisplay[]>;
        screens: () => Promise<CachedScreen[]>;
        states: () => Promise<ScreenState>;
    }): Promise<boolean> {
        if (this.syncStatus.isSyncing) {
            console.log('Sync already in progress');
            return false;
        }

        this.syncStatus = {
            isSyncing: true,
            lastSync: null,
            lastError: null
        };
        this.notifySyncStatusChange();

        try {
            const failures: string[] = [];
            const safeFetch = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
                try {
                    return await fn();
                } catch (error) {
                    failures.push(label);
                    console.error(`Failed to fetch ${label}:`, error);
                    return null;
                }
            };

            const [displays, screens, states] = await Promise.all([
                safeFetch('displays', fetchFn.displays),
                safeFetch('screens', fetchFn.screens),
                safeFetch('states', fetchFn.states)
            ]);

            let didUpdate = false;

            if (displays) {
                try {
                    await this.cacheDisplays(displays);
                    didUpdate = true;
                } catch (error) {
                    failures.push('displays-cache');
                    console.error('Failed to cache displays:', error);
                }
            }

            if (screens) {
                try {
                    await this.cacheScreens(screens, displayId);
                    didUpdate = true;
                } catch (error) {
                    failures.push('screens-cache');
                    console.error('Failed to cache screens:', error);
                }
            }

            if (states) {
                try {
                    await this.cacheStates(states);
                    didUpdate = true;
                } catch (error) {
                    failures.push('states-cache');
                    console.error('Failed to cache states:', error);
                }
            }

            if (didUpdate) {
                try {
                    const metadata = await cacheDB.getMetadata();
                    await cacheDB.updateMetadata({
                        id: 'meta',
                        version: 1,
                        lastUpdated: new Date().toISOString(),
                        displayIds: metadata?.displayIds || [displayId]
                    });
                } catch (error) {
                    failures.push('metadata');
                    console.error('Failed to update cache metadata:', error);
                }
            }

            this.syncStatus = {
                isSyncing: false,
                lastSync: didUpdate ? new Date() : null,
                lastError: failures.length > 0 ? `Sync issues: ${failures.join(', ')}` : null
            };
            this.notifySyncStatusChange();

            return didUpdate;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Sync failed:', error);

            this.syncStatus = {
                isSyncing: false,
                lastSync: null,
                lastError: errorMessage
            };
            this.notifySyncStatusChange();

            return false;
        }
    }

    async isCacheValid(maxAge: number = 5 * 60 * 1000): Promise<boolean> {
        try {
            const metadata = await cacheDB.getMetadata();
            if (!metadata) {
                return false;
            }

            const lastUpdated = new Date(metadata.lastUpdated);
            const now = new Date();
            const age = now.getTime() - lastUpdated.getTime();

            return age < maxAge;
        } catch (error) {
            console.error('Failed to check cache validity:', error);
            return false;
        }
    }

    async clearDisplayData(displayId: string): Promise<void> {
        try {
            await cacheDB.deleteScreensAndStatesByDisplayId(displayId);
        } catch (error) {
            console.error('Failed to clear display data:', error);
            throw error;
        }
    }

    async clearAll(): Promise<void> {
        try {
            await cacheDB.clear();
        } catch (error) {
            console.error('Failed to clear cache:', error);
            throw error;
        }
    }

    async deleteDatabase(): Promise<void> {
        try {
            await cacheDB.deleteDatabase();
        } catch (error) {
            console.error('Failed to delete database:', error);
            throw error;
        }
    }

    getSyncStatus(): SyncStatus {
        return { ...this.syncStatus };
    }
}

export const signageCache = new SignageCache();
export type { CachedScreen, SyncStatus };
