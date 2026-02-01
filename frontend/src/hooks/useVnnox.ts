import { useState, useEffect, useCallback } from "react";
import { trpcClient } from "../utils/trpc";

interface VnnoxPlayer {
    playerId: string;
    playerName: string;
    terminalIp?: string;
    terminalSn?: string;
    firmwareVersion?: string;
    onlineStatus?: number;
    lastOnlineTime?: string;
}

interface PlayerListResult {
    total: number;
    players: VnnoxPlayer[];
}

export function useVnnox() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        trpcClient.vnnox.isEnabled.query()
            .then((result) => setIsEnabled(result.enabled))
            .catch(() => setIsEnabled(false))
            .finally(() => setLoading(false));
    }, []);

    const searchPlayers = useCallback(async (params?: {
        count?: number;
        start?: number;
        name?: string;
    }): Promise<PlayerListResult> => {
        return trpcClient.vnnox.listPlayers.query(params);
    }, []);

    const linkPlayer = useCallback(async (
        screenId: string,
        playerId: string,
        playerName: string,
    ) => {
        return trpcClient.vnnox.linkPlayer.mutate({ screenId, playerId, playerName });
    }, []);

    const unlinkPlayer = useCallback(async (screenId: string) => {
        return trpcClient.vnnox.unlinkPlayer.mutate({ screenId });
    }, []);

    return {
        isEnabled,
        loading,
        searchPlayers,
        linkPlayer,
        unlinkPlayer,
    };
}

export type { VnnoxPlayer, PlayerListResult };
