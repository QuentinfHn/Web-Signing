const DB_NAME = 'SignageCache';
const DB_VERSION = 1;
const STORES = {
    metadata: 'metadata',
    displays: 'displays',
    screens: 'screens',
    states: 'states'
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

interface CacheMetadata {
    id: 'meta';
    version: number;
    lastUpdated: string;
    displayIds: string[];
}

interface CacheDisplay {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

interface CacheScreen {
    id: string;
    displayId: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    contentId: string | null;
    updatedAt: string;
}

interface CacheState {
    screenId: string;
    src: string | null;
    scenario: string | null;
    updated: string;
    slideshow?: {
        images: string[];
        intervalMs: number;
    };
}

class SignageCacheDB {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    async init(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                const error = request.error;
                if (error) {
                    reject(new Error(`IndexedDB error: ${error.message}`));
                } else {
                    reject(new Error('Unknown IndexedDB error'));
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORES.metadata)) {
                    const metadataStore = db.createObjectStore(STORES.metadata, { keyPath: 'id' });
                    metadataStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.displays)) {
                    const displayStore = db.createObjectStore(STORES.displays, { keyPath: 'id' });
                    displayStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    displayStore.createIndex('name', 'name', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.screens)) {
                    const screenStore = db.createObjectStore(STORES.screens, { keyPath: 'id' });
                    screenStore.createIndex('displayId', 'displayId', { unique: false });
                    screenStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.states)) {
                    const stateStore = db.createObjectStore(STORES.states, { keyPath: 'screenId' });
                    stateStore.createIndex('updated', 'updated', { unique: false });
                }
            };
        });

        return this.initPromise;
    }

    private async getDB(): Promise<IDBDatabase> {
        if (!this.db) {
            await this.init();
        }
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db;
    }

    private async transaction<T>(
        storeNames: StoreName[],
        mode: IDBTransactionMode,
        callback: (transaction: IDBTransaction) => T
    ): Promise<T> {
        const db = await this.getDB();
        const transaction = db.transaction(storeNames, mode);

        return new Promise((resolve, reject) => {
            try {
                const result = callback(transaction);

                transaction.oncomplete = () => resolve(result);
                transaction.onerror = () => {
                    const error = transaction.error;
                    if (error) {
                        reject(new Error(`Transaction error: ${error.message}`));
                    } else {
                        reject(new Error('Unknown transaction error'));
                    }
                };
                transaction.onabort = () => {
                    const error = transaction.error;
                    reject(new Error(`Transaction aborted: ${error?.message || 'Unknown reason'}`));
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    async getMetadata(): Promise<CacheMetadata | null> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.metadata], 'readonly');
                const store = transaction.objectStore(STORES.metadata);
                const request = store.get('meta');

                request.onsuccess = () => resolve(request.result as CacheMetadata | null);
                request.onerror = () => reject(new Error(`Failed to get metadata: ${request.error?.message || 'Unknown error'}`));
            });
        } catch (error) {
            console.error('Error getting metadata:', error);
            return null;
        }
    }

    async updateMetadata(metadata: CacheMetadata): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.metadata], 'readwrite');
                const store = transaction.objectStore(STORES.metadata);
                const request = store.put(metadata);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(`Failed to update metadata: ${request.error?.message || 'Unknown error'}`));
            });
        } catch (error) {
            console.error('Error updating metadata:', error);
            throw error;
        }
    }

    async getAllDisplays(): Promise<CacheDisplay[]> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.displays], 'readonly');
                const store = transaction.objectStore(STORES.displays);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result as CacheDisplay[]);
                request.onerror = () => reject(new Error(`Failed to get displays: ${request.error?.message || 'Unknown error'}`));
            });
        } catch (error) {
            console.error('Error getting displays:', error);
            return [];
        }
    }

    async getDisplay(displayId: string): Promise<CacheDisplay | null> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.displays], 'readonly');
                const store = transaction.objectStore(STORES.displays);
                const request = store.get(displayId);

                request.onsuccess = () => resolve(request.result as CacheDisplay | null);
                request.onerror = () => reject(new Error(`Failed to get display: ${request.error?.message || 'Unknown error'}`));
            });
        } catch (error) {
            console.error('Error getting display:', error);
            return null;
        }
    }

    async putDisplays(displays: CacheDisplay[]): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.displays], 'readwrite');
                const store = transaction.objectStore(STORES.displays);

                let completed = 0;
                const total = displays.length;

                displays.forEach((display) => {
                    const request = store.put(display);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === total) {
                            resolve();
                        }
                    };
                    request.onerror = () => reject(new Error(`Failed to put display: ${request.error?.message || 'Unknown error'}`));
                });
            });
        } catch (error) {
            console.error('Error putting displays:', error);
            throw error;
        }
    }

    async getScreensByDisplayId(displayId: string): Promise<CacheScreen[]> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.screens], 'readonly');
                const store = transaction.objectStore(STORES.screens);
                const index = store.index('displayId');
                const request = index.getAll(displayId);

                request.onsuccess = () => resolve(request.result as CacheScreen[]);
                request.onerror = () => reject(new Error(`Failed to get screens: ${request.error?.message || 'Unknown error'}`));
            });
        } catch (error) {
            console.error('Error getting screens:', error);
            return [];
        }
    }

    async putScreens(screens: CacheScreen[]): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.screens], 'readwrite');
                const store = transaction.objectStore(STORES.screens);

                let completed = 0;
                const total = screens.length;

                screens.forEach((screen) => {
                    const request = store.put(screen);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === total) {
                            resolve();
                        }
                    };
                    request.onerror = () => reject(new Error(`Failed to put screen: ${request.error?.message || 'Unknown error'}`));
                });
            });
        } catch (error) {
            console.error('Error putting screens:', error);
            throw error;
        }
    }

    async getAllStates(): Promise<Record<string, CacheState>> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.states], 'readonly');
                const store = transaction.objectStore(STORES.states);
                const request = store.getAll();

                request.onsuccess = () => {
                    const states = request.result as CacheState[];
                    const stateMap: Record<string, CacheState> = {};
                    states.forEach((state) => {
                        stateMap[state.screenId] = state;
                    });
                    resolve(stateMap);
                };
                request.onerror = () => reject(new Error(`Failed to get states: ${request.error?.message || 'Unknown error'}`));
            });
        } catch (error) {
            console.error('Error getting states:', error);
            return {};
        }
    }

    async getState(screenId: string): Promise<CacheState | null> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.states], 'readonly');
                const store = transaction.objectStore(STORES.states);
                const request = store.get(screenId);

                request.onsuccess = () => resolve(request.result as CacheState | null);
                request.onerror = () => reject(new Error(`Failed to get state: ${request.error?.message || 'Unknown error'}`));
            });
        } catch (error) {
            console.error('Error getting state:', error);
            return null;
        }
    }

    async putStates(states: Record<string, CacheState>): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORES.states], 'readwrite');
                const store = transaction.objectStore(STORES.states);

                const stateArray = Object.values(states);
                let completed = 0;
                const total = stateArray.length;

                stateArray.forEach((state) => {
                    const request = store.put(state);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === total) {
                            resolve();
                        }
                    };
                    request.onerror = () => reject(new Error(`Failed to put state: ${request.error?.message || 'Unknown error'}`));
                });
            });
        } catch (error) {
            console.error('Error putting states:', error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            const db = await this.getDB();
            const storeNames = Object.values(STORES);

            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(storeNames, 'readwrite');

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => {
                    const error = transaction.error;
                    if (error) {
                        reject(new Error(`Transaction error: ${error.message}`));
                    } else {
                        reject(new Error('Unknown transaction error'));
                    }
                };

                storeNames.forEach((storeName) => {
                    const store = transaction.objectStore(storeName);
                    store.clear();
                });
            });
        } catch (error) {
            console.error('Error clearing database:', error);
            throw error;
        }
    }

    async deleteDatabase(): Promise<void> {
        const request = indexedDB.deleteDatabase(DB_NAME);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to delete database: ${request.error?.message || 'Unknown error'}`));
            request.onblocked = () => {
                console.warn('Database delete request blocked');
            };
        });
    }
}

export const cacheDB = new SignageCacheDB();
export type { CacheDisplay, CacheScreen, CacheState, CacheMetadata };
