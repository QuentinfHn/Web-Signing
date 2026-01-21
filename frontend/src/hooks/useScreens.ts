import { useState, useEffect } from "react";
import { trpcClient, Screen } from "../utils/trpc";
import { ImportResult, ConflictMode } from "../types/screen";

export function useScreens() {
    const [screens, setScreens] = useState<Screen[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadScreens = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await trpcClient.screens.list.query();
            setScreens(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load screens";
            setError(errorMessage);
            console.error("Failed to load screens:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const updateScreen = async (id: string, data: Partial<Screen>) => {
        try {
            await trpcClient.screens.update.mutate({
                id,
                x: data.x,
                y: data.y,
                width: data.width,
                height: data.height,
                name: data.name,
                displayId: data.displayId,
                lat: data.lat,
                lng: data.lng,
                address: data.address,
            });
            await loadScreens();
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to update screen";
            setError(errorMessage);
            console.error("Failed to update screen:", err);
            return false;
        }
    };

    const deleteScreen = async (id: string) => {
        try {
            await trpcClient.screens.delete.mutate({ id });
            await loadScreens();
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to delete screen";
            setError(errorMessage);
            console.error("Failed to delete screen:", err);
            return false;
        }
    };

    const createScreen = async (data: {
        displayId: string;
        x: number;
        y: number;
        width: number;
        height: number;
        name?: string;
        lat?: number;
        lng?: number;
        address?: string;
    }) => {
        try {
            await trpcClient.screens.create.mutate({
                displayId: data.displayId,
                x: data.x,
                y: data.y,
                width: data.width,
                height: data.height,
                name: data.name || undefined,
                lat: data.lat || undefined,
                lng: data.lng || undefined,
                address: data.address || undefined,
            });
            await loadScreens();
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create screen";
            setError(errorMessage);
            console.error("Failed to create screen:", err);
            return false;
        }
    };

    const exportScreens = async () => {
        try {
            return await trpcClient.screens.exportAll.query();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to export screens";
            setError(errorMessage);
            console.error("Export failed:", err);
            return null;
        }
    };

    const importScreens = async (screens: Screen[], conflictMode: ConflictMode): Promise<ImportResult | null> => {
        try {
            const result = await trpcClient.screens.importScreens.mutate({
                screens,
                conflictMode,
            });
            await loadScreens();
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Import failed";
            setError(errorMessage);
            console.error("Import failed:", err);
            return {
                created: 0,
                updated: 0,
                skipped: 0,
                errors: [errorMessage],
            };
        }
    };

    useEffect(() => {
        loadScreens();
    }, []);

    return {
        screens,
        isLoading,
        error,
        loadScreens,
        updateScreen,
        deleteScreen,
        createScreen,
        exportScreens,
        importScreens,
    };
}
