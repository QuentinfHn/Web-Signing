import { prisma } from "../prisma/client.js";

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class InMemoryCache {
    private stateCache: Map<string, CacheEntry<any>> = new Map();
    private scenarioCache: Map<string, CacheEntry<any>> = new Map();
    private screensCache: Map<string, CacheEntry<any>> = new Map();
    private displaysCache: CacheEntry<any> | null = null;

    private readonly DEFAULT_TTL = 5 * 60 * 1000;

    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    invalidateAll(): void {
        this.stateCache.clear();
        this.scenarioCache.clear();
        this.screensCache.clear();
        this.displaysCache = null;
    }

    invalidateState(screenId?: string): void {
        if (screenId) {
            this.stateCache.delete(screenId);
        } else {
            this.stateCache.clear();
        }
    }

    invalidateScenario(screenId?: string, scenario?: string): void {
        if (screenId && scenario) {
            this.scenarioCache.delete(`${screenId}:${scenario}`);
        } else if (screenId) {
            for (const key of this.scenarioCache.keys()) {
                if (key.startsWith(`${screenId}:`)) {
                    this.scenarioCache.delete(key);
                }
            }
        } else {
            this.scenarioCache.clear();
        }
    }

    invalidateScreens(displayId?: string): void {
        if (displayId) {
            this.screensCache.delete(displayId);
        } else {
            this.screensCache.clear();
        }
    }

    invalidateDisplays(): void {
        this.displaysCache = null;
    }

    async getState(screenId: string, fetchFn: () => Promise<any>): Promise<any> {
        const cached = this.stateCache.get(screenId);
        if (cached && !this.isExpired(cached)) {
            return cached.data;
        }

        const data = await fetchFn();
        this.stateCache.set(screenId, {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL
        });

        return data;
    }

    async getAllStates(fetchFn: () => Promise<any>): Promise<any> {
        const cached = this.stateCache.get('all');
        if (cached && !this.isExpired(cached)) {
            return cached.data;
        }

        const data = await fetchFn();
        this.stateCache.set('all', {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL
        });

        return data;
    }

    async getScenario(screenId: string, scenario: string, fetchFn: () => Promise<any>): Promise<any> {
        const key = `${screenId}:${scenario}`;
        const cached = this.scenarioCache.get(key);
        if (cached && !this.isExpired(cached)) {
            return cached.data;
        }

        const data = await fetchFn();
        this.scenarioCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL
        });

        return data;
    }

    async getAllScenarios(fetchFn: () => Promise<any>): Promise<any> {
        const cached = this.scenarioCache.get('all');
        if (cached && !this.isExpired(cached)) {
            return cached.data;
        }

        const data = await fetchFn();
        this.scenarioCache.set('all', {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL
        });

        return data;
    }

    async getScreens(displayId: string, fetchFn: () => Promise<any>): Promise<any> {
        const cached = this.screensCache.get(displayId);
        if (cached && !this.isExpired(cached)) {
            return cached.data;
        }

        const data = await fetchFn();
        this.screensCache.set(displayId, {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL
        });

        return data;
    }

    async getAllScreens(fetchFn: () => Promise<any>): Promise<any> {
        const cached = this.screensCache.get('all');
        if (cached && !this.isExpired(cached)) {
            return cached.data;
        }

        const data = await fetchFn();
        this.screensCache.set('all', {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL
        });

        return data;
    }

    async getDisplays(fetchFn: () => Promise<any>): Promise<any> {
        if (this.displaysCache && !this.isExpired(this.displaysCache)) {
            return this.displaysCache.data;
        }

        const data = await fetchFn();
        this.displaysCache = {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL
        };

        return data;
    }

    getCacheStats() {
        return {
            states: this.stateCache.size,
            scenarios: this.scenarioCache.size,
            screens: this.screensCache.size,
            displays: this.displaysCache ? 1 : 0,
            total: this.stateCache.size + this.scenarioCache.size + this.screensCache.size + (this.displaysCache ? 1 : 0)
        };
    }
}

export const cache = new InMemoryCache();

export async function getCachedScreenState(screenId: string): Promise<any> {
    return cache.getState(screenId, async () => {
        return prisma.screenState.findUnique({
            where: { screenId }
        });
    });
}

export async function getAllCachedScreenStates(): Promise<any> {
    return cache.getAllStates(async () => {
        return prisma.screenState.findMany();
    });
}

export async function getCachedScenario(screenId: string, scenario: string): Promise<any> {
    return cache.getScenario(screenId, scenario, async () => {
        return prisma.scenarioAssignment.findUnique({
            where: {
                screenId_scenario: { screenId, scenario }
            },
            include: { images: { orderBy: { order: 'asc' } } }
        });
    });
}

export async function getAllCachedScenarios(): Promise<any> {
    return cache.getAllScenarios(async () => {
        return prisma.scenarioAssignment.findMany({
            include: { images: { orderBy: { order: 'asc' } } }
        });
    });
}

export async function getCachedScreens(displayId: string): Promise<any> {
    return cache.getScreens(displayId, async () => {
        return prisma.screen.findMany({
            where: { displayId },
            orderBy: { id: 'asc' }
        });
    });
}

export async function getAllCachedScreens(): Promise<any> {
    return cache.getAllScreens(async () => {
        return prisma.screen.findMany({
            orderBy: { id: 'asc' }
        });
    });
}

export async function getCachedDisplays(): Promise<any> {
    return cache.getDisplays(async () => {
        return prisma.display.findMany({
            orderBy: { id: 'asc' },
            include: { _count: { select: { screens: true } } }
        });
    });
}

export function invalidateStateCache(screenId?: string): void {
    cache.invalidateState(screenId);
}

export function invalidateScenarioCache(screenId?: string, scenario?: string): void {
    cache.invalidateScenario(screenId, scenario);
}

export function invalidateScreensCache(displayId?: string): void {
    cache.invalidateScreens(displayId);
}

export function invalidateDisplaysCache(): void {
    cache.invalidateDisplays();
}

export function invalidateAllCache(): void {
    cache.invalidateAll();
}

export function getCacheStats() {
    return cache.getCacheStats();
}
