import { useState, useEffect } from "react";
import { trpcClient, Display } from "../utils/trpc";

export function useDisplays() {
    const [displays, setDisplays] = useState<Display[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDisplays = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await trpcClient.displays.list.query();
            setDisplays(data);

            if (data.length === 0) {
                await trpcClient.displays.initFromScreens.mutate();
                const newData = await trpcClient.displays.list.query();
                setDisplays(newData);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load displays";
            setError(errorMessage);
            console.error("Failed to load displays:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const createDisplay = async (name: string) => {
        if (!name.trim()) return false;
        try {
            await trpcClient.displays.create.mutate({ name: name.trim() });
            await loadDisplays();
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create display";
            setError(errorMessage);
            console.error("Failed to create display:", err);
            return false;
        }
    };

    const deleteDisplay = async (id: string) => {
        try {
            await trpcClient.displays.delete.mutate({ id });
            await loadDisplays();
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to delete display";
            setError(errorMessage);
            console.error("Failed to delete display:", err);
            return false;
        }
    };

    useEffect(() => {
        loadDisplays();
    }, []);

    return {
        displays,
        isLoading,
        error,
        loadDisplays,
        createDisplay,
        deleteDisplay,
    };
}
