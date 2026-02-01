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
            const [displays, screens, states] = await Promise.all([
                fetchFn.displays().catch((error) => {
                    console.error('Failed to fetch displays:', error);
                    return null;
                }),
                fetchFn.screens().catch((error) => {
                    console.error('Failed to fetch screens:', error);
                    return null;
                }),
                fetchFn.states().catch((error) => {
                    console.error('Failed to fetch states:', error);
                    return null;
                })
            ]);

            if (displays) {
                await this.cacheDisplays(displays);
            }

            if (screens) {
                await this.cacheScreens(screens, displayId);
            }

            if (states) {
                await this.cacheStates(states);
            }

            const metadata = await cacheDB.getMetadata();
            await cacheDB.updateMetadata({
                id: 'meta',
                version: 1,
                lastUpdated: new Date().toISOString(),
                displayIds: metadata?.displayIds || [displayId]
            });

            this.syncStatus = {
                isSyncing: false,
                lastSync: new Date(),
                lastError: null
            };
            this.notifySyncStatusChange();

            return true;
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
